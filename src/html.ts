import { DomRef, isDomRef } from './domRef.js';
import { setCurrentSpecifier, setCurrentTarget } from './reactive.js';
import { trustedTypePolicy } from './trustedType.js';
import { createComment, createTextNode, error, isArray, sanitizeHtml } from './utils.js';

export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingRE = /\$\$--(.+?)--\$\$/g;

/**
 * @public
 */
export type FunctionInterpolator = (...args: any[]) => unknown;
/**
 * @public
 */
export type DynamicInterpolators = FunctionInterpolator | Template | DomRef;

type Fixer = (...args: any[]) => void;

/**
 * @public
 */
type TemplateKey = string | number;

function isDynamicInterpolator(value: unknown): value is DynamicInterpolators {
  return isFuncInterpolator(value) || isTemplate(value) || isDomRef(value);
}

function isFuncInterpolator(value: unknown): value is FunctionInterpolator {
  return typeof value === 'function';
}

function isTemplate(value: unknown): value is Template {
  return value instanceof Template;
}

/**
 * @public
 */
export class Template {
  // The templates with same pattern should share the same DocumentFragment,
  // it is unparsed.
  #originalDoc: DocumentFragment;
  get originalDoc() {
    return this.#originalDoc;
  }

  // This is cloned from originalDoc and will be used to render the template,
  // it will be parsed by template parser.
  #doc: DocumentFragment | null = null;
  get isInitialized() {
    return !!this.#doc;
  }

  // Keep track of the root nodes of the template's document fragment,
  // so that we can unmount them.
  #rootNodes: Node[] = [];

  /**
   * The key is used to identify if two templates are the same during diff algorithm.
   */
  #key: TemplateKey | null = null;
  setKey(key: TemplateKey) {
    this.#key = key;
  }

  /**
   * The children templates of the current template.
   * const templateA = html`<div>${() => 1}</div>`;
   * const templateB = html`<div>${templateA} -- ${templateA}</div>`;
   * templateB.children will be [templateA]
   */
  #children: Set<Template> = new Set();
  get children() {
    return this.#children;
  }

  /**
   * The parent template of the current template.
   * const templateA = html`<div>${() => 1}</div>`;
   * const templateB = html`<div>${templateA} -- ${templateA}</div>`;
   * templateA.parent will be templateB, it will be null if the template is not used in another template.
   */
  #parent: Template | null = null;
  get parent() {
    return this.#parent;
  }

  /**
   * When true, it means the template is currently in use, the this.doc will be an empty fragment,
   * when false, it means the template is not appended/inserted to the active DOM tree or another document fragment,
   * so this.doc contains everything it has.
   */
  get isInUse() {
    return !!this.#doc && this.#doc.childNodes.length === 0;
  }

  #dynamicPartToGetterMap: Map<string, DynamicInterpolators>;
  get dynamicPartToGetterMap() {
    return this.#dynamicPartToGetterMap;
  }

  // The fixers that are needed to be called during mounting stage.
  #dpToMountingFixerMap: Map<string, Fixer> = new Map();
  // The fixers that are needed to be called during updating stage.
  #dpToUpdatingFixerMap: Map<string, Fixer> = new Map();
  // The fixers that are needed to be called during unmounting stage.
  #dpToUnmountingFixerMap: Map<string, Fixer> = new Map();

  constructor(originalDoc: DocumentFragment, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.#originalDoc = originalDoc;
    this.#dynamicPartToGetterMap = dynamicPartToGetterMap;
  }

  #init() {
    if (this.isInitialized) {
      return;
    }
    this.#doc = this.#originalDoc.cloneNode(true) as DocumentFragment;
    this.#rootNodes = Array.from(this.#doc.childNodes);
    this.#parseTemplate(this.#doc);
  }

  /**
   * In case where a template could be shared by multiple custom elements:
   *
   * case 1: declare a template in a shared module / global scope
   * export const template = html`<div>${funcInterpolator}</div>`;
   *
   * case 2: the template is used in multiple places in another template
   * const templateA = html`<div>${() => 1}</div>`;
   * const templateB = html`<div>${templateA} -- ${templateA}</div>`;
   *
   * In any of the above cases, we should clone a new template instance from the original template,
   * these template instances are going to share the same dynamicPartToGetterMap so that
   * all the instances will be collected by those reactive data it depends on.
   */
  clone() {
    return new Template(this.#originalDoc, this.#dynamicPartToGetterMap);
  }

  cloneIfInUse() {
    return this.isInUse ? this.clone() : this;
  }

  /**
   * @public
   * A Template keeps track of its root nodes of its document fragment,
   * if the nodes of its document fragment are appended to the active DOM tree or
   * another Template, we can make a call to unmount() to get the nodes back.
   */
  unmount() {
    if (!this.isInUse) {
      return;
    }
    this.#rootNodes.forEach(node => this.#doc!.appendChild(node));
    // If a template is unmounted, we should trigger all its children templates to be unmounted.
    this.#children.forEach(child => child.unmount());
    if (this.#parent) {
      this.#parent.#children.delete(this);
      this.#parent = null;
    }
    this.#dpToUnmountingFixerMap.forEach(fixer => fixer());
  }

  /**
   * @public
   * Mount the template to a parent template with the given anchor node,
   * or mount to a DOM node directly as a root template.
   */
  mountTo(parentTemplate: Template, anchorNode: Node | null): void;
  mountTo(parent: Node): void;
  mountTo(parent: Node | Template, anchorNode: Node | null = null) {
    // The template is lazy initialized, and will only be initialized once when it is mounted.
    this.#init();
    this.#dpToMountingFixerMap.forEach(fixer => fixer());
    if (parent instanceof Template) {
      if (__DEV__ && this.isInUse) {
        error(
          `The parent template is already in use, you should unmount it first if you want to mount it to another parent template, parent template is:`,
          parent,
        );
        return;
      }
      this.#parent = parent;
      parent.#children.add(this);
      anchorNode!.parentNode!.insertBefore(this.#doc!, anchorNode);
    } else {
      parent.appendChild(this.#doc!);
      // This is a root template
      this.#parent = null;
    }
  }

  /**
   * @public
   */
  update(dynamicPartSpecifier: string = '') {
    if (dynamicPartSpecifier) {
      const fixer = this.#dpToUpdatingFixerMap.get(dynamicPartSpecifier);
      fixer && fixer();
      return;
    }
    this.#dpToUpdatingFixerMap.forEach(fixer => fixer());
  }

  /**
   * If two templates are created from the same template pattern, they are considered the same.
   * If two templates are the same, we can then use one template's dynamicPartToGetterMap to render the other template.
   */
  sameAs(other: Template) {
    return this.#originalDoc === other.#originalDoc;
  }

  // This is useful in DOM updates during re-rendering.
  adoptGettersFrom(other: Template) {
    if (!this.sameAs(other)) {
      return;
    }
    this.#dynamicPartToGetterMap = other.dynamicPartToGetterMap;
  }

  #parseTemplate(doc: DocumentFragment) {
    this.#parseNodes(doc.childNodes);
  }

  #parseNodes(nodes: NodeListOf<ChildNode>) {
    nodes.forEach(node => {
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          this.#parseElement(node as Element);
          break;
        case Node.TEXT_NODE:
          this.#parseText(node as Text);
          break;
      }
    });
  }

  #parseElement(element: Element) {
    if (element.hasAttributes()) {
      this.#parseAttributes(element.attributes);
    }

    if (element.hasChildNodes()) {
      this.#parseNodes(element.childNodes);
    }
  }

  #parseAttributes(attributes: NamedNodeMap) {
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i];
      this.#parseAttribute(attribute);
    }
  }

  #parseAttribute(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const name = attribute.name;

    if (name.startsWith('@')) {
      this.#parseEvent(attribute);
      return;
    } else if (name === 'ref') {
      this.#parseRef(attribute);
      return;
    } else if (name.startsWith(tplPrefix) && name.endsWith(tplSuffix)) {
      // Custom directive
      const ownerElement = attribute.ownerElement!;
      // remove the attribute
      ownerElement.removeAttribute(name);

      this.#dpToMountingFixerMap.set(name, () => {
        const directive = this.#dynamicPartToGetterMap.get(name);
        if (!isFuncInterpolator(directive)) {
          __DEV__ && error(`You must provide a function as the directive, but you provided:`, directive);
          return;
        }
        directive(ownerElement);
      });

      this.#dpToUnmountingFixerMap.set(name, () => {
        const directive = this.#dynamicPartToGetterMap.get(name);
        if (!isFuncInterpolator(directive)) {
          __DEV__ && error(`You must provide a function as the directive, but you provided:`, directive);
          return;
        }
        directive(null);
      });
      return;
    }

    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    while (m) {
      const dynamicPartSpecifier = m[0];
      const fixerArgs = {
        dynamicPartSpecifier,
        name,
        attribute,
        pattern,
        oldValue: null,
      };
      const attrFixer = this.#attributeFixer.bind(null, fixerArgs);
      this.#dpToMountingFixerMap.set(dynamicPartSpecifier, attrFixer);
      this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, attrFixer);
      m = bindingRE.exec(pattern);
    }
  }

  #attributeFixer = (fixerArgs: {
    dynamicPartSpecifier: string,
    name: string,
    attribute: Attr,
    pattern: string,
    oldValue: unknown,
  }) => {
    const { dynamicPartSpecifier, name, attribute, pattern } = fixerArgs;
    const getter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(getter)) {
      if (__DEV__ === 'development') {
        error(`You must provide a function as the attribute value interpolator, but you provided:`, getter);
      }
      return;
    }

    const newValue = String(this.#runGetter(getter, dynamicPartSpecifier));
    if (fixerArgs.oldValue === newValue) {
      // No need to update
      return;
    }
    fixerArgs.oldValue = newValue;

    attribute.ownerElement?.setAttribute(name, pattern.replace(dynamicPartSpecifier, newValue));
  };

  #parseEvent(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const name = attribute.name;
    const eventName = name.slice(1);
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      if (__DEV__ === 'development') {
        error(`Failed to parse the event binding, event name is ${eventName}, DOM node is: `, attribute.ownerElement);
      }
      return;
    }

    const ownerElement = attribute.ownerElement!;
    // remove the attribute
    attribute.ownerElement?.removeAttribute(name);
    const dynamicPartSpecifier = m[0];

    const eventFixer = this.#eventFixer.bind(null, ownerElement, dynamicPartSpecifier, eventName);
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, eventFixer);
    this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, eventFixer); // event needs to be updated

    this.#dpToUnmountingFixerMap.set(dynamicPartSpecifier, () => {
      const handler = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(handler)) {
        if (__DEV__ === 'development') {
          error(
            `Field to remove event listener, you must provide a function as the event handler, but you provided:`,
            handler,
          );
        }
        return;
      }
      ownerElement?.removeEventListener(eventName, handler);
    });
  }

  #eventFixer = (ownerElement: Element, dynamicPartSpecifier: string, eventName: string) => {
    const handler = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(handler)) {
      if (__DEV__ === 'development') {
        error(
          `Field to add event listener, you must provide a function as the event handler, but you provided:`,
          handler,
        );
      }
      return;
    }
    // Remove the old event listener if any
    ownerElement?.removeEventListener(eventName, handler);
    ownerElement?.addEventListener(eventName, handler);
  };

  #parseRef(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      __DEV__ && error(`Failed to parse the ref binding, DOM node is: `, attribute.ownerElement);
      return;
    }

    const ownerElement = attribute.ownerElement;
    // remove the attribute
    attribute.ownerElement?.removeAttribute(attribute.name);

    const dynamicPartSpecifier = m[0];
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, () => {
      const refSetter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(refSetter)) {
        __DEV__ && error(`You must provide a function as the ref setter, but you provided:`, refSetter);
        return;
      }
      refSetter(ownerElement);
    });

    this.#dpToUnmountingFixerMap.set(dynamicPartSpecifier, () => {
      const refSetter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(refSetter)) {
        __DEV__ && error(`You must provide a function as the ref setter, but you provided:`, refSetter);
        return;
      }
      refSetter(null);
    });
  }

  #parseText(text: Text) {
    bindingRE.lastIndex = 0;

    const content = text.nodeValue || '';
    let m = bindingRE.exec(content);
    if (!m) {
      // Static text, return
      return;
    }
    const dynamicPartSpecifier = m[0];
    if (!this.#dynamicPartToGetterMap.has(dynamicPartSpecifier)) {
      __DEV__ && error(`There is no corresponding getter for the dynamic part specifier:`, dynamicPartSpecifier);
    }
    /**
     * split the text into two parts based on the dynamic part specifier:
     * spliting the following text:
     *   'Static text dynamicPartSpecifier1 more static text dynamicPartSpecifier2'
     * into:
     *  ['Static text ', ' more static text dynamicPartSpecifier2']
     */
    const texts = content.split(dynamicPartSpecifier);
    if (texts.length !== 2) {
      __DEV__ && error(`Failed to split the text into two parts:`, content);
      return;
    }

    const anchorNode = createComment(__DEV__ ? 'anchor' : '');
    let nodesToBeRendered: Node[] = [];
    let dynamicNode: Text | Template | Template[] = createTextNode('');
    let remainingTextNode: Text | null = null;
    if (texts[0] === '' && texts[1] === '') {
      // Which means the text is only the dynamic part specifier: 'dynamicPartSpecifier'
      nodesToBeRendered = [dynamicNode, anchorNode];
    } else if (texts[0] === '') {
      // Which means the dynamic part specifier is at the beginning of the text: 'dynamicPartSpecifier more static text'
      remainingTextNode = createTextNode(texts[1]);
      nodesToBeRendered = [dynamicNode, anchorNode, remainingTextNode];
    } else if (texts[1] === '') {
      // Which means the dynamic part specifier is at the end of the text: 'Static text dynamicPartSpecifier'
      nodesToBeRendered = [createTextNode(texts[0]), dynamicNode, anchorNode];
    } else {
      // Which means the dynamic part specifier is in the middle of the text: 'Static text dynamicPartSpecifier more static text'
      remainingTextNode = createTextNode(texts[1]);
      nodesToBeRendered = [createTextNode(texts[0]), dynamicNode, anchorNode, remainingTextNode];
    }

    text.replaceWith(...nodesToBeRendered);

    // Process the remaining text node recursively
    if (remainingTextNode) {
      this.#parseText(remainingTextNode);
    }

    const fixerArgs = {
      dynamicPartSpecifier,
      dynamicNode,
      anchorNode,
      oldValue: null,
    };

    const textFixer = this.#textFixer.bind(null, fixerArgs);
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, textFixer);
    this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, textFixer);
  }

  #textFixer = (fixerArgs: {
    dynamicPartSpecifier: string,
    dynamicNode: Text | Template | Template[],
    anchorNode: Comment,
    oldValue: unknown,
  }) => {
    const dynamicInterpolator = this.#dynamicPartToGetterMap.get(fixerArgs.dynamicPartSpecifier)!;
    const value = isFuncInterpolator(dynamicInterpolator)
      ? this.#runGetter(dynamicInterpolator, fixerArgs.dynamicPartSpecifier)
      : dynamicInterpolator;

    const isNotInUsedTemplate = isTemplate(value) && !value.isInUse;
    if (
      fixerArgs.oldValue === value &&
      // Old value and the new value is the same template, but the template is not in use,
      // which means the template was unmounted before and now we need to mount it.
      !isNotInUsedTemplate
    ) {
      // No need to update
      return;
    }
    fixerArgs.oldValue = value;

    const previous = fixerArgs.dynamicNode;
    const current = value;

    if (isArray(previous) && !isArray(current)) {
      // Unmount the old dynamic node
      previous.forEach(tpl => tpl.unmount());

      // Mount the new dynamic node
      if (isTemplate(current)) {
        fixerArgs.dynamicNode = current.cloneIfInUse();
        fixerArgs.dynamicNode.mountTo(this, fixerArgs.anchorNode);
      } else {
        fixerArgs.dynamicNode = createTextNode(String(current));
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode, fixerArgs.anchorNode);
      }
    } else if (!isArray(previous) && isArray(current)) {
      // Unmount the old dynamic node
      if (isTemplate(previous)) {
        previous.unmount();
      } else {
        previous.remove();
      }

      if (__DEV__ && current.some(item => !isTemplate(item))) {
        error(`For list rendering, you must provide an array of templates, but you provided:`, current);
        return;
      }
      // Mount the new dynamic node
      (current as Template[]).forEach(tpl => {
        tpl.mountTo(this, fixerArgs.anchorNode);
      });
      fixerArgs.dynamicNode = current;
    } else if (!isArray(previous) && !isArray(current)) {
      // Unmount the old dynamic node
      if (isTemplate(previous)) {
        previous.unmount();
      } else {
        previous.remove();
      }

      // Mount the new dynamic node
      if (isTemplate(current)) {
        fixerArgs.dynamicNode = current.cloneIfInUse();
        fixerArgs.dynamicNode.mountTo(this, fixerArgs.anchorNode);
      } else {
        fixerArgs.dynamicNode = createTextNode(String(current));
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode, fixerArgs.anchorNode);
      }
    } else {
      // TODO: using keyed diff algorithm instead
      const oldList = previous as Template[];
      const newList = current as Template[];
      const oldLen = oldList.length;
      const newLen = newList.length;
      let idx = 0;

      while (idx < oldLen && idx < newLen) {
        const oldTpl = oldList[idx];
        const newTpl = newList[idx];
        if (oldTpl.sameAs(newTpl)) {
          oldTpl.adoptGettersFrom(newTpl);
          oldTpl.update();
        } else {
          oldTpl.unmount();
          oldList[idx] = newTpl.cloneIfInUse();
          oldList[idx].mountTo(this, fixerArgs.anchorNode);
        }
        idx++;
      }

      if (oldLen > newLen) {
        oldList.slice(idx).forEach(tpl => tpl.unmount());
        oldList.splice(idx);
      } else if (oldLen < newLen) {
        newList.slice(idx).forEach(tpl => {
          const newTpl = tpl.cloneIfInUse();
          oldList.push(newTpl);
          newTpl.mountTo(this, fixerArgs.anchorNode);
        });
      }

      fixerArgs.dynamicNode = oldList;
    }
  };

  #runGetter(getter: FunctionInterpolator, dynamicPartSpecifier: string) {
    setCurrentTarget(this);
    setCurrentSpecifier(dynamicPartSpecifier);
    const value = getter();
    setCurrentSpecifier(null);
    setCurrentTarget(null);
    return value;
  }
}

const templateCache = new Map<string, DocumentFragment>();

const safeHtml = createTemplateFunction(false);
const safeHtmlWithKey = (stringsOrKey: TemplateKey, strings: TemplateStringsArray, ...values: unknown[]) => {
  const template = safeHtml(strings, ...values);
  template.setKey(stringsOrKey);
  return template;
};

/**
 * @public
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Template;
/**
 * @public
 */
export function html(key: TemplateKey): (strings: TemplateStringsArray, ...values: unknown[]) => Template;
export function html(
  stringsOrKey: TemplateStringsArray | TemplateKey,
  ...values: unknown[]
) {
  const firstArgType = typeof stringsOrKey;
  const isKeyed = firstArgType === 'string' || firstArgType === 'number';
  return isKeyed
    ? safeHtmlWithKey.bind(null, stringsOrKey as TemplateKey)
    : safeHtml(stringsOrKey as TemplateStringsArray, ...values);
}

/**
 * @public
 */
export const unsafeHtml = createTemplateFunction(true);

function createTemplateFunction(isUnsafe: boolean) {
  return (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Template => {
    let dynamicPartId = 0;
    const dynamicPartToGetterMap = new Map<string, DynamicInterpolators>();
    const templateString = String.raw(
      { raw: strings },
      ...values.map(value => {
        if (isDynamicInterpolator(value)) {
          const dynamicPartPlaceholder = `${tplPrefix}dynamic${dynamicPartId++}${tplSuffix}`;
          if (isDomRef(value)) {
            dynamicPartToGetterMap.set(dynamicPartPlaceholder, (el: Element) => value.value = el);
            return `ref=${dynamicPartPlaceholder}`;
          }
          dynamicPartToGetterMap.set(dynamicPartPlaceholder, value);
          return dynamicPartPlaceholder;
        }
        return isUnsafe ? String(value) : sanitizeHtml(String(value));
      }),
    );
    if (templateCache.has(templateString)) {
      const cachedOriginalDoc = templateCache.get(templateString)!;
      // We need to update the dynamic parts
      return new Template(cachedOriginalDoc, dynamicPartToGetterMap);
    }
    const template = document.createElement('template');
    template.innerHTML = trustedTypePolicy.createHTML(templateString);
    const tpl = new Template(template.content, dynamicPartToGetterMap);
    templateCache.set(templateString, tpl.originalDoc);
    return tpl;
  };
}

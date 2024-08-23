import { DomRef, isDomRef } from './domRef.js';
import { createComment, createTextNode, isArray } from './utils.js';

export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingRE = /\$\$--(.+?)--\$\$/g;

type FunctionInterpolator = (...args: any[]) => unknown;
type DynamicInterpolators = FunctionInterpolator | Template | DomRef;

type Fixer = (...args: any[]) => void;

function isDynamicInterpolator(value: unknown): value is DynamicInterpolators {
  return isFuncInterpolator(value) || isTemplate(value) || isDomRef(value);
}

function isFuncInterpolator(value: unknown): value is FunctionInterpolator {
  return typeof value === 'function';
}

function isTemplate(value: unknown): value is Template {
  return value instanceof Template;
}

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
  // Which means that html`` is lazy, it will only be initialized when it is used, i.e. its publick doc property is accessed.
  // So make a call to html`` is cheap.
  get doc() {
    if (!this.#doc) {
      this.#init();
    }
    return this.#doc!;
  }
  get isParsed() {
    return this.#doc !== null;
  }

  // Keep track of the root nodes of the template's document fragment,
  // so that we can retrieve them.
  #rootNodes: Node[] = [];

  /**
   * When true, it means the template is currently in use, the this.doc will be an empty fragment,
   * when false, it means the template is not appended/inserted to the active DOM tree or another document fragment,
   * so this.doc contains everything it has.
   */
  get isInUse() {
    return !!this.#doc && this.#doc.childNodes.length === 0;
  }

  dynamicPartToGetterMap: Map<string, DynamicInterpolators>;
  dynamicPartToFixerMap: Map<string, Fixer> = new Map();

  constructor(originalDoc: DocumentFragment, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.#originalDoc = originalDoc;
    this.dynamicPartToGetterMap = dynamicPartToGetterMap;
  }

  #init() {
    this.#doc = this.#originalDoc.cloneNode(true) as DocumentFragment;
    this.#rootNodes = Array.from(this.#doc.childNodes);
    this.#parseTemplate(this.#doc);
    this.triggerRender();
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
    return new Template(this.#originalDoc, this.dynamicPartToGetterMap);
  }

  cloneIfInUse() {
    return this.isInUse ? this.clone() : this;
  }

  /**
   * A Template keeps track of its root nodes of its document fragment,
   * if the nodes of its document fragment are appended to the active DOM tree or
   * another Template, we can make a call to retrieve() to get the nodes back.
   */
  retrieve() {
    if (!this.isInUse) {
      return;
    }
    this.#rootNodes.forEach(node => this.#doc!.appendChild(node));
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
    this.dynamicPartToGetterMap = other.dynamicPartToGetterMap;
  }

  triggerRender(dynamicPartSpecifier: string = '') {
    if (dynamicPartSpecifier) {
      const fixer = this.dynamicPartToFixerMap.get(dynamicPartSpecifier);
      fixer && fixer();
      return;
    }
    this.dynamicPartToFixerMap.forEach(fixer => fixer());
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
      this.dynamicPartToFixerMap.set(dynamicPartSpecifier, this.#attributeFixer.bind(null, fixerArgs));
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
    const getter = this.dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(getter)) {
      // TODO: add dev only error
      return;
    }

    const newValue = String(getter());
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
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      // TODO: throw error
      return;
    }
    const eventName = name.slice(1);
    const dynamicPartSpecifier = m[0];
    const handler = this.dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(handler)) {
      // TODO: add dev only error
      return;
    }
    attribute.ownerElement?.addEventListener(eventName, e => handler(e));
    // remove the attribute
    attribute.ownerElement?.removeAttribute(name);

    // TODO: need cleanup mechanism
  }

  #parseRef(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      // TODO: throw error
      return;
    }
    const dynamicPartSpecifier = m[0];
    const refSetter = this.dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(refSetter)) {
      // TODO: add dev only error
      return;
    }
    refSetter(attribute.ownerElement);
    // TODO: need cleanup mechanism, and dev mode warning

    // remove the attribute
    attribute.ownerElement?.removeAttribute(attribute.name);
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
    if (!this.dynamicPartToGetterMap.has(dynamicPartSpecifier)) {
      // TODO: add dev only error
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
      // TODO: add dev only error, the texts array should exactly have 2 elements
    }

    const anchorNode = createComment('anchor' /* TODO: add debug info in dev mode */);
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

    this.dynamicPartToFixerMap.set(dynamicPartSpecifier, this.#textFixer.bind(null, fixerArgs));
  }

  #textFixer = (fixerArgs: {
    dynamicPartSpecifier: string,
    dynamicNode: Text | Template | Template[],
    anchorNode: Comment,
    oldValue: unknown,
  }) => {
    const dynamicInterpolator = this.dynamicPartToGetterMap.get(fixerArgs.dynamicPartSpecifier)!;
    const value = isFuncInterpolator(dynamicInterpolator) ? dynamicInterpolator() : dynamicInterpolator;

    if (fixerArgs.oldValue === value) {
      // No need to update
      return;
    }
    fixerArgs.oldValue = value;

    const previous = fixerArgs.dynamicNode;
    const current = value;

    if (isArray(previous) && !isArray(current)) {
      // Unmount the old dynamic node
      previous.forEach(tpl => tpl.retrieve());

      // Mount the new dynamic node
      if (isTemplate(current)) {
        fixerArgs.dynamicNode = current.cloneIfInUse();
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode.doc, fixerArgs.anchorNode);
      } else {
        fixerArgs.dynamicNode = createTextNode(String(current));
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode, fixerArgs.anchorNode);
      }
    } else if (!isArray(previous) && isArray(current)) {
      // Unmount the old dynamic node
      if (isTemplate(previous)) {
        previous.retrieve();
      } else {
        previous.remove();
      }

      // Mount the new dynamic node
      // TODO: add dev only check to make sure the current is a template array
      (current as Template[]).forEach(tpl => {
        fixerArgs.anchorNode.parentNode!.insertBefore(tpl.doc, fixerArgs.anchorNode);
      });
      fixerArgs.dynamicNode = current;
    } else if (!isArray(previous) && !isArray(current)) {
      // Unmount the old dynamic node
      if (isTemplate(previous)) {
        previous.retrieve();
      } else {
        previous.remove();
      }

      // Mount the new dynamic node
      if (isTemplate(current)) {
        fixerArgs.dynamicNode = current.cloneIfInUse();
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode.doc, fixerArgs.anchorNode);
      } else {
        fixerArgs.dynamicNode = createTextNode(String(current));
        fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode, fixerArgs.anchorNode);
      }
    } else {
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
          oldTpl.triggerRender();
        } else {
          oldTpl.retrieve();
          oldList[idx] = newTpl.cloneIfInUse();
          fixerArgs.anchorNode.parentNode!.insertBefore(oldList[idx].doc, fixerArgs.anchorNode);
        }
        idx++;
      }

      if (oldLen > newLen) {
        oldList.slice(idx).forEach(tpl => tpl.retrieve());
        oldList.splice(idx);
      } else if (oldLen < newLen) {
        newList.slice(idx).forEach(tpl => {
          const newTpl = tpl.cloneIfInUse();
          oldList.push(newTpl);
          fixerArgs.anchorNode.parentNode!.insertBefore(newTpl.doc, fixerArgs.anchorNode);
        });
      }

      fixerArgs.dynamicNode = oldList;
    }
  };
}

const templateCache = new Map<string, DocumentFragment>();

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Template {
  let dynamicPartId = 0;
  const dynamicPartToGetterMap = new Map<string, DynamicInterpolators>();
  const templateString = String.raw(
    { raw: strings },
    ...values.map(value => {
      if (isDynamicInterpolator(value)) {
        const dynamicPartPlaceholder = `${tplPrefix}Dynamic${dynamicPartId++}${tplSuffix}`;
        if (isDomRef(value)) {
          dynamicPartToGetterMap.set(dynamicPartPlaceholder, (el: Element) => value.value = el);
          return `ref=${dynamicPartPlaceholder}`;
        }
        dynamicPartToGetterMap.set(dynamicPartPlaceholder, value);
        return dynamicPartPlaceholder;
      }
      return value;
    }),
  );
  if (templateCache.has(templateString)) {
    const cachedOriginalDoc = templateCache.get(templateString)!;
    // We need to update the dynamic parts
    return new Template(cachedOriginalDoc, dynamicPartToGetterMap);
  }
  const template = document.createElement('template');
  template.innerHTML = templateString;
  const tpl = new Template(template.content, dynamicPartToGetterMap);
  templateCache.set(templateString, tpl.originalDoc);
  return tpl;
}

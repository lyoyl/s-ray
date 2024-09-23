import { DomRef, isDomRef } from './domRef.js';
import { popReactiveContextStack, pushReactiveContextStack } from './reactive.js';
import { queueTask } from './scheduler.js';
import { createSSRTemplateFunction, isSSRTemplate } from './ssr/htmlSSR.js';
import { trustedTypePolicy } from './trustedType.js';
import {
  createComment,
  createDocumentFragment,
  createTextNode,
  error,
  hydratingError,
  isArray,
  isTextNode,
  sanitizeHtml,
} from './utils.js';

export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingIdentifier = 'dynamic';
export const bindingRE = new RegExp(`\\$\\$--${bindingIdentifier}(\\d+?)--\\$\\$`, 'g');

export const selfStartAnchor = '[';
export const selfEndAnchor = ']';
export const childrenAnchor = '^';
const hydratingSelfStartAnchorRE = /^\[\d+-(\d*)$/;
const hydratingSelfEndAnchorRE = /^\d+-(\d*)\]$/;
const hydratingTplListStartAnchorRE = /^\[\[\d+-(\d*)$/;
const hydratingTplListEndAnchorRE = /^\d+-(\d*)\]\]$/;
const hydratingTextStartAnchorRE = /^%\d+-(\d+)$/;
const hydratingTextEndAnchorRE = /^\d+-(\d+)%$/;

type PropSpecifier = ':' | '?';

interface AttributeFixerParams {
  name: string;
  ownerElement: Element;
  pattern: string;
  dynamicParts: {
    dynamicPartSpecifier: string,
    oldValue: unknown,
  }[];
}

interface ChildrenFixerParams {
  dynamicPartSpecifier: string;
  dynamicNode: Text | Template | Template[];
  anchorNode: Comment;
  oldValue: unknown;
  hydratingDocs?: Array<ChildNode[]>; // Only used during hydration
}

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

export function isDynamicInterpolator(value: unknown): value is DynamicInterpolators {
  return isFuncInterpolator(value) || isTemplate(value) || isDomRef(value) || (__SSR__ && isSSRTemplate(value));
}

export function isFuncInterpolator(value: unknown): value is FunctionInterpolator {
  return typeof value === 'function';
}

export function isTemplate(value: unknown): value is Template {
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

  #selfStartAnchor!: Comment;
  #selfEndAnchor!: Comment;

  #isHydrating = false;

  constructor(originalDoc: DocumentFragment, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.#originalDoc = originalDoc;
    this.#dynamicPartToGetterMap = dynamicPartToGetterMap;
  }

  #init() {
    if (this.isInitialized) {
      return;
    }
    this.#doc = this.#originalDoc.cloneNode(true) as DocumentFragment;
    this.#selfStartAnchor = createComment(selfStartAnchor);
    this.#selfEndAnchor = createComment(selfEndAnchor);
    this.#doc.prepend(this.#selfStartAnchor);
    this.#doc.append(this.#selfEndAnchor);
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
      if (__ENV__ === 'development' && this.isInUse) {
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

  moveToBefore(tpl: Template) {
    if (!this.isInUse) {
      __ENV__ === 'development' &&
        error(`The template is not in use, you can't move it, the template being moved is:`, this);
    }
    this.#rootNodes.forEach(node => {
      tpl.#selfStartAnchor.parentNode!.insertBefore(node, tpl.#selfStartAnchor);
    });
  }

  moveToAfter(tpl: Template) {
    if (!this.isInUse) {
      __ENV__ === 'development' &&
        error(`The template is not in use, you can't move it, the template being moved is:`, this);
    }
    for (let i = this.#rootNodes.length - 1; i >= 0; i--) {
      tpl.#selfEndAnchor.parentNode!.insertBefore(this.#rootNodes[i], tpl.#selfEndAnchor.nextSibling);
    }
  }

  /**
   * @public
   */
  update(dynamicPartSpecifier: string = '') {
    if (dynamicPartSpecifier) {
      const fixer = this.#dpToUpdatingFixerMap.get(dynamicPartSpecifier);
      fixer && queueTask(fixer);
      return;
    }
    this.#dpToUpdatingFixerMap.forEach(fixer => queueTask(fixer));
  }

  hydrate(childNodes: ChildNode[]) {
    this.#isHydrating = true;
    this.#doc = createDocumentFragment();
    this.#selfStartAnchor = childNodes[0] as Comment;
    this.#selfEndAnchor = childNodes[childNodes.length - 1] as Comment;
    if (__ENV__ === 'development') {
      if (
        this.#selfStartAnchor.nodeType !== Node.COMMENT_NODE ||
        !this.#selfStartAnchor.nodeValue?.match?.(hydratingSelfStartAnchorRE)
      ) {
        hydratingError(
          `The first node of the shadow root should be a comment with a specific format, but we got:`,
          this.#selfStartAnchor,
        );
      }
      if (
        this.#selfEndAnchor.nodeType !== Node.COMMENT_NODE ||
        !this.#selfEndAnchor.nodeValue?.match?.(hydratingSelfEndAnchorRE)
      ) {
        hydratingError(
          `The last node of the shadow root should be a comment with a specific format, but we got:`,
          this.#selfEndAnchor,
        );
      }
    }
    this.#rootNodes = Array.from(childNodes);
    this.#hydrateNodes(childNodes);
    this.#dpToMountingFixerMap.forEach(fixer => fixer());
    this.#isHydrating = false;
  }

  #hydrateNodes(childNodes: ChildNode[]) {
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      // ignore the self start anchor and self end anchor
      if (node === this.#selfStartAnchor || node === this.#selfEndAnchor) {
        continue;
      }
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          this.#hydrateElement(node as Element);
          break;
        case Node.COMMENT_NODE:
          const tplListMatch = node.nodeValue?.match?.(hydratingTplListStartAnchorRE);
          if (tplListMatch) {
            const nodeCount = this.#hydrateTplListChildren(node.nextSibling, tplListMatch[1] /* dId */);
            i += nodeCount;
            break;
          }

          const dynamicTextMatch = node.nodeValue?.match?.(hydratingTextStartAnchorRE);
          if (dynamicTextMatch) {
            const nodeCount = this.#hydrateDynamicTextChildren(node, dynamicTextMatch[1] /* dId */);
            i += nodeCount;
            break;
          }

          const tplMatch = node.nodeValue?.match?.(hydratingSelfStartAnchorRE);
          const dId = tplMatch && tplMatch[1];
          if (tplMatch && dId) {
            const nodeCount = this.#hydrateTplChildren(node, dId);
            i += nodeCount;
          }
          break;
      }
    }
  }

  #hydrateElement(element: Element) {
    if (element.hasAttributes()) {
      this.#parseAttributes(element.attributes);
    }

    if (element.hasChildNodes()) {
      this.#hydrateNodes([...element.childNodes]);
    }
  }

  #hydrateTplListChildren(hydratingSelfStartAnchor: ChildNode | null, dId: string) {
    const hydratingDocs: ChildrenFixerParams['hydratingDocs'] = [];
    let current = hydratingSelfStartAnchor;
    if (__ENV__ === 'development') {
      // The current node should be the self start anchor of the template
      if (!this.#isHydratingSelfStartAnchor(current)) {
        hydratingError(
          `Failed to find the self start anchor for the template list, start anchor is:`,
          hydratingSelfStartAnchor,
          'template is:',
          this,
        );
      }
    }

    let nodeCount = 0;
    let tempDoc: ChildNode[] = [];
    while (current) {
      if (current.nodeType === Node.COMMENT_NODE && current.nodeValue?.match(hydratingTplListEndAnchorRE)) {
        break;
      }
      tempDoc.push(current);
      nodeCount++;
      if (this.#isHydratingSelfEndAnchor(current)) {
        hydratingDocs.push(tempDoc);
        tempDoc = [];
      }
      current = current.nextSibling;
    }

    const dynamicPartSpecifier = `$$--${bindingIdentifier}${dId}--$$`;
    const dynamicNode = createTextNode('');
    const anchorNode = current?.nextSibling as Comment;
    if (__ENV__ === 'development' && !this.#isChildrenAnchor(anchorNode)) {
      hydratingError(
        `Failed to find the children anchor node for the template list, start anchor is:`,
        hydratingSelfStartAnchor,
        'template is:',
        this,
      );
    }
    const fixerArgs: ChildrenFixerParams = {
      dynamicPartSpecifier,
      dynamicNode,
      anchorNode,
      oldValue: null,
      hydratingDocs,
    };

    this.#bindChildrenFixer(fixerArgs);
    return nodeCount;
  }

  #hydrateTplChildren(hydratingSelfStartAnchor: ChildNode | null, dId: string) {
    const hydratingDocs: ChildrenFixerParams['hydratingDocs'] = [];
    let nodeCount = 0;
    let tempDoc: ChildNode[] = [];
    let current = hydratingSelfStartAnchor;
    while (current) {
      tempDoc.push(current);
      nodeCount++;
      if (this.#isHydratingSelfEndAnchor(current)) {
        hydratingDocs.push(tempDoc);
        tempDoc = [];
        break;
      }
      current = current.nextSibling;
    }

    const dynamicPartSpecifier = `$$--${bindingIdentifier}${dId}--$$`;
    const dynamicNode = createTextNode('');
    const anchorNode = current?.nextSibling as Comment;
    if (__ENV__ === 'development' && !this.#isChildrenAnchor(anchorNode)) {
      hydratingError(
        `Failed to find the children anchor node for the template, start anchor is:`,
        hydratingSelfStartAnchor,
        'template is:',
        this,
      );
    }
    const fixerArgs: ChildrenFixerParams = {
      dynamicPartSpecifier,
      dynamicNode,
      anchorNode,
      oldValue: null,
      hydratingDocs,
    };

    this.#bindChildrenFixer(fixerArgs);

    return nodeCount;
  }

  #hydrateDynamicTextChildren(hydratingTextStartAnchor: ChildNode | null, dId: string) {
    const dynamicPartSpecifier = `$$--${bindingIdentifier}${dId}--$$`;
    const dynamicNode = hydratingTextStartAnchor?.nextSibling;
    if (!isTextNode(dynamicNode)) {
      __ENV__ === 'development' &&
        hydratingError(
          `Failed to find the dynamic text node, start anchor is:`,
          hydratingTextStartAnchor,
          'template is:',
          this,
        );
      return 0;
    }

    const hydratingTextEndAnchor = dynamicNode.nextSibling;
    if (!this.#isHydratingTextEndAnchor(hydratingTextEndAnchor)) {
      __ENV__ === 'development' &&
        hydratingError(
          `Failed to find the end anchor for the dynamic text node, start anchor is:`,
          hydratingTextStartAnchor,
          'template is:',
          this,
        );
      return 0;
    }

    const anchorNode = hydratingTextEndAnchor.nextSibling;
    if (!this.#isChildrenAnchor(anchorNode)) {
      __ENV__ === 'development' &&
        hydratingError(
          `Failed to find the children anchor node for the dynamic text node, start anchor is:`,
          hydratingTextStartAnchor,
          'template is:',
          this,
        );
      return 0;
    }

    const fixerArgs: ChildrenFixerParams = {
      dynamicPartSpecifier,
      dynamicNode,
      anchorNode,
      oldValue: null,
    };

    this.#bindChildrenFixer(fixerArgs);
    return 3;
  }

  #isHydratingSelfStartAnchor(node: ChildNode | null) {
    return node && node.nodeType === Node.COMMENT_NODE && node.nodeValue?.match(hydratingSelfStartAnchorRE);
  }

  #isHydratingSelfEndAnchor(node: ChildNode | null) {
    return node && node.nodeType === Node.COMMENT_NODE && node.nodeValue?.match(hydratingSelfEndAnchorRE);
  }

  #isHydratingTextEndAnchor(node: ChildNode | null): node is Comment {
    return !!(node && node.nodeType === Node.COMMENT_NODE && node.nodeValue?.match(hydratingTextEndAnchorRE));
  }

  #isChildrenAnchor(node: ChildNode | null): node is Comment {
    return !!(node && node.nodeType === Node.COMMENT_NODE && node.nodeValue === childrenAnchor);
  }

  toString() {
    return ''; /* SSR Only */
  }

  /**
   * If two templates are created from the same template pattern, they are considered the same.
   * If two templates are the same, we can then use one template's dynamicPartToGetterMap to render the other template.
   */
  sameAs(other: Template) {
    return this.#originalDoc === other.#originalDoc;
  }

  strictSameAs(other: Template) {
    return this.sameAs(other) && this.#key && other.#key && this.#key === other.#key;
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
          this.#parseChildren(node as Text);
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
    const ownerElement = attribute.ownerElement!;

    const name = attribute.name;
    if (name.startsWith('@')) {
      this.#parseEvent(attribute);
      return;
    } else if (
      name.startsWith(':') ||
      name.startsWith('?')
    ) {
      this.#parsePropertyBinding(attribute);
    } else if (name === 'ref') {
      this.#parseRef(attribute);
      return;
    } else if (name.startsWith(tplPrefix) && name.endsWith(tplSuffix)) {
      // TODO: SSR support for custom directive
      // Custom directive
      // remove the attribute
      ownerElement.removeAttribute(name);

      this.#dpToMountingFixerMap.set(name, () => {
        const directive = this.#dynamicPartToGetterMap.get(name);
        if (!isFuncInterpolator(directive)) {
          __ENV__ === 'development' &&
            error(`You must provide a function as the directive, but you provided:`, directive);
          return;
        }
        directive(ownerElement);
      });

      this.#dpToUnmountingFixerMap.set(name, () => {
        const directive = this.#dynamicPartToGetterMap.get(name);
        if (!isFuncInterpolator(directive)) {
          __ENV__ === 'development' &&
            error(`You must provide a function as the directive, but you provided:`, directive);
          return;
        }
        directive(null);
      });
      return;
    }

    const pattern = attribute.value;
    const isHydratingNormalAttr = this.#isHydrating && name.startsWith('#');
    if (isHydratingNormalAttr) {
      // remove the attribute
      ownerElement.removeAttribute(name);
    }

    let m = bindingRE.exec(pattern);
    const fixerArgs: AttributeFixerParams = {
      name: isHydratingNormalAttr ? name.slice(1) : name,
      ownerElement,
      pattern,
      dynamicParts: [],
    };
    while (m) {
      const dynamicPartSpecifier = m[0];
      fixerArgs.dynamicParts.push({
        dynamicPartSpecifier,
        oldValue: null,
      });
      m = bindingRE.exec(pattern);
    }
    if (!fixerArgs.dynamicParts.length) {
      // No dynamic part found, no need to bind fixer
      return;
    }
    const attrFixer = this.#attributeFixer.bind(null, fixerArgs);
    fixerArgs.dynamicParts.forEach(({ dynamicPartSpecifier }) => {
      this.#dpToMountingFixerMap.set(dynamicPartSpecifier, attrFixer);
      this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, attrFixer);
    });
  }

  #attributeFixer = (fixerArgs: AttributeFixerParams) => {
    const { name, ownerElement, pattern, dynamicParts } = fixerArgs;
    let needUpdate = false;
    let newAttrValue = pattern;
    dynamicParts.forEach((dynamicPartObj) => {
      const getter = this.#dynamicPartToGetterMap.get(dynamicPartObj.dynamicPartSpecifier);
      if (!isFuncInterpolator(getter)) {
        if (__ENV__ === 'development') {
          error(`You must provide a function as the attribute value interpolator, but you provided:`, getter);
        }
        return;
      }
      const newValue = String(this.#runGetter(getter, dynamicPartObj.dynamicPartSpecifier));
      newAttrValue = newAttrValue.replace(dynamicPartObj.dynamicPartSpecifier, newValue);
      if (dynamicPartObj.oldValue === newValue) {
        // No need to update
        return;
      }
      needUpdate = true;
      dynamicPartObj.oldValue = newValue;
    });
    if (!needUpdate || this.#isHydrating) {
      return;
    }
    ownerElement.setAttribute(name, newAttrValue);
  };

  #parsePropertyBinding(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const rawAttrName = attribute.name;
    const propSpecifier = rawAttrName[0] as PropSpecifier;
    const propName = rawAttrName.slice(1);
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      if (__ENV__ === 'development') {
        error(
          `Failed to parse the property binding, property name is ${propName}, DOM node is: `,
          attribute.ownerElement,
        );
      }
      return;
    }

    const ownerElement = attribute.ownerElement!;
    const dynamicPartSpecifier = m[0];

    const propFixer = this.#propertyFixer.bind(
      null,
      ownerElement,
      dynamicPartSpecifier,
      propSpecifier,
      rawAttrName,
      propName,
    );
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, propFixer);
    this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, propFixer);
  }

  #propertyFixer = (
    ownerElement: Element,
    dynamicPartSpecifier: string,
    propSpecifier: PropSpecifier,
    rawAttrName: string,
    propName: string,
  ) => {
    const getter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(getter)) {
      if (__ENV__ === 'development') {
        error(`You must provide a function as the property value interpolator, but you provided:`, getter);
      }
      return;
    }
    const newValue = this.#runGetter(getter, dynamicPartSpecifier);
    // remove the attribute
    ownerElement?.removeAttribute(rawAttrName);
    if (this.#isHydrating && propSpecifier === '?') {
      // We don't need to set the property value for boolean attributes during hydration,
      // because we have already set the attribute value in the DOM: <input disabled>
      return;
    }
    (ownerElement as any)[propName] = propSpecifier === '?' ? newValue !== false : newValue;
  };

  #parseEvent(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const rawAttrName = attribute.name;
    const eventName = rawAttrName.slice(1);
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      if (__ENV__ === 'development') {
        error(`Failed to parse the event binding, event name is ${eventName}, DOM node is: `, attribute.ownerElement);
      }
      return;
    }

    const ownerElement = attribute.ownerElement!;
    const dynamicPartSpecifier = m[0];

    const eventFixer = this.#eventFixer.bind(null, ownerElement, dynamicPartSpecifier, rawAttrName, eventName);
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, eventFixer);
    this.#dpToUpdatingFixerMap.set(dynamicPartSpecifier, eventFixer); // event needs to be updated

    this.#dpToUnmountingFixerMap.set(dynamicPartSpecifier, () => {
      const handler = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(handler)) {
        if (__ENV__ === 'development') {
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

  #eventFixer = (ownerElement: Element, dynamicPartSpecifier: string, rawAttrName: string, eventName: string) => {
    const handler = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
    if (!isFuncInterpolator(handler)) {
      if (__ENV__ === 'development') {
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
    // remove the attribute
    ownerElement?.removeAttribute(rawAttrName);
  };

  #parseRef(attribute: Attr) {
    bindingRE.lastIndex = 0;

    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      __ENV__ === 'development' && error(`Failed to parse the ref binding, DOM node is: `, attribute.ownerElement);
      return;
    }

    const ownerElement = attribute.ownerElement;
    const dynamicPartSpecifier = m[0];
    this.#dpToMountingFixerMap.set(dynamicPartSpecifier, () => {
      const refSetter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(refSetter)) {
        __ENV__ === 'development' &&
          error(`You must provide a function as the ref setter, but you provided:`, refSetter);
        return;
      }
      refSetter(ownerElement);
      // remove the attribute
      ownerElement?.removeAttribute(attribute.name);
    });

    this.#dpToUnmountingFixerMap.set(dynamicPartSpecifier, () => {
      const refSetter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      if (!isFuncInterpolator(refSetter)) {
        __ENV__ === 'development' &&
          error(`You must provide a function as the ref setter, but you provided:`, refSetter);
        return;
      }
      refSetter(null);
    });
  }

  #parseChildren(text: Text) {
    bindingRE.lastIndex = 0;

    const content = text.nodeValue || '';
    let m = bindingRE.exec(content);
    if (!m) {
      // Static text, return
      return;
    }
    const dynamicPartSpecifier = m[0];
    if (!this.#dynamicPartToGetterMap.has(dynamicPartSpecifier)) {
      __ENV__ === 'development' &&
        error(`There is no corresponding getter for the dynamic part specifier:`, dynamicPartSpecifier);
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
      __ENV__ === 'development' && error(`Failed to split the text into two parts:`, content);
      return;
    }

    const anchorNode = createComment(childrenAnchor);
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
      this.#parseChildren(remainingTextNode);
    }

    const fixerArgs: ChildrenFixerParams = {
      dynamicPartSpecifier,
      dynamicNode,
      anchorNode,
      oldValue: null,
    };

    this.#bindChildrenFixer(fixerArgs);
  }

  #bindChildrenFixer = (fixerArgs: ChildrenFixerParams) => {
    const childrenFixer = this.#childrenFixer.bind(null, fixerArgs);
    this.#dpToMountingFixerMap.set(fixerArgs.dynamicPartSpecifier, childrenFixer);
    this.#dpToUpdatingFixerMap.set(fixerArgs.dynamicPartSpecifier, childrenFixer);
    // Reset oldValue when unmounting
    this.#dpToUnmountingFixerMap.set(fixerArgs.dynamicPartSpecifier, () => {
      fixerArgs.oldValue = null;
    });
  };

  #childrenFixer = (fixerArgs: ChildrenFixerParams) => {
    const dynamicInterpolator = this.#dynamicPartToGetterMap.get(fixerArgs.dynamicPartSpecifier)!;
    const value = isFuncInterpolator(dynamicInterpolator)
      ? this.#runGetter(dynamicInterpolator, fixerArgs.dynamicPartSpecifier)
      : dynamicInterpolator;

    if (fixerArgs.oldValue === value) {
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

      if (__ENV__ === 'development' && current.some(item => !isTemplate(item))) {
        error(`For list rendering, you must provide an array of templates, but you provided:`, current);
        return;
      }

      if (
        __ENV__ === 'development' && this.#isHydrating &&
        (!fixerArgs.hydratingDocs || !fixerArgs.hydratingDocs.length ||
          fixerArgs.hydratingDocs.length !== current.length)
      ) {
        hydratingError(
          `Failed to hydrate the template list because the length of the hydrating docs is mismatched, hydrating templates are:`,
          fixerArgs.hydratingDocs,
          'current templates are:',
          current,
        );
        return;
      }
      // Mount the new dynamic node
      (current as Template[]).forEach(tpl => {
        if (this.#isHydrating) {
          tpl.hydrate(fixerArgs.hydratingDocs!.shift()!);
        } else {
          tpl.mountTo(this, fixerArgs.anchorNode);
        }
      });
      fixerArgs.dynamicNode = current;
    } else if (!isArray(previous) && !isArray(current)) {
      // Unmount the old dynamic node
      if (isTemplate(previous)) {
        previous.unmount();
      } else {
        // Hydrating dynamic text binding will hit this case as well, we should not remove the text node during hydration
        !this.#isHydrating && previous.remove();
      }

      // Mount the new dynamic node
      if (isTemplate(current)) {
        fixerArgs.dynamicNode = current.cloneIfInUse();
        if (this.#isHydrating) {
          if (__ENV__ === 'development' && (!fixerArgs.hydratingDocs || fixerArgs.hydratingDocs.length !== 1)) {
            hydratingError(
              `Failed to hydrate the template, there must be one template to hydrate, but we got:`,
              fixerArgs.hydratingDocs,
            );
            return;
          }
          fixerArgs.dynamicNode.hydrate(fixerArgs.hydratingDocs!.shift()!);
        } else {
          fixerArgs.dynamicNode.mountTo(this, fixerArgs.anchorNode);
        }
      } else {
        // Hydrating dynamic text binding will hit this case as well, we don't need to do anything during hydration
        if (!this.#isHydrating) {
          fixerArgs.dynamicNode = createTextNode(String(current));
          fixerArgs.anchorNode.parentNode!.insertBefore(fixerArgs.dynamicNode, fixerArgs.anchorNode);
        }
      }
    } else {
      const oldList = previous as Template[];
      const newList = current as Template[];

      let oldStartIdx = 0;
      let oldEndIdx = oldList.length - 1;
      let newStartIdx = 0;
      let newEndIdx = newList.length - 1;

      let oldStartTpl = oldList[oldStartIdx];
      let oldEndTpl = oldList[oldEndIdx];
      let newStartTpl = newList[newStartIdx];
      let newEndTpl = newList[newEndIdx];

      while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (!oldStartTpl) {
          oldStartTpl = oldList[++oldStartIdx];
        } else if (!oldEndTpl) {
          oldEndTpl = oldList[--oldEndIdx];
        } else if (oldStartTpl.strictSameAs(newStartTpl)) {
          oldStartTpl.adoptGettersFrom(newStartTpl);
          oldStartTpl.update();
          oldStartTpl = oldList[++oldStartIdx];
          newStartTpl = newList[++newStartIdx];
        } else if (oldEndTpl.strictSameAs(newEndTpl)) {
          oldEndTpl.adoptGettersFrom(newEndTpl);
          oldEndTpl.update();
          oldEndTpl = oldList[--oldEndIdx];
          newEndTpl = newList[--newEndIdx];
        } else if (oldStartTpl.strictSameAs(newEndTpl)) {
          oldStartTpl.moveToAfter(oldEndTpl);
          oldStartTpl.adoptGettersFrom(newEndTpl);
          oldStartTpl.update();
          oldStartTpl = oldList[++oldStartIdx];
          newEndTpl = newList[--newEndIdx];
        } else if (oldEndTpl.strictSameAs(newStartTpl)) {
          oldEndTpl.moveToBefore(oldStartTpl);
          oldEndTpl.adoptGettersFrom(newStartTpl);
          oldEndTpl.update();
          oldEndTpl = oldList[--oldEndIdx];
          newStartTpl = newList[++newStartIdx];
        } else {
          const idxInOld = oldList.findIndex(tpl => tpl.strictSameAs(newStartTpl));
          if (idxInOld > 0) {
            const tplToBeMoved = oldList[idxInOld];
            tplToBeMoved.moveToBefore(oldStartTpl);
            tplToBeMoved.adoptGettersFrom(newStartTpl);
            tplToBeMoved.update();
            oldList[idxInOld] = undefined as any;
            newStartTpl = newList[++newStartIdx];
          } else {
            const newTpl = newStartTpl.cloneIfInUse();
            newTpl.mountTo(this, oldStartTpl.#selfStartAnchor);
            newStartTpl = newList[++newStartIdx];
          }
        }
      }

      if (oldEndIdx < oldStartIdx && newEndIdx >= newStartIdx) {
        for (let i = newStartIdx; i <= newEndIdx; i++) {
          const newTpl = newList[i].cloneIfInUse();
          newTpl.mountTo(this, oldStartTpl ? oldStartTpl.#selfStartAnchor : fixerArgs.anchorNode);
        }
      } else if (newEndIdx < newStartIdx && oldEndIdx >= oldStartIdx) {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
          oldList[i].unmount();
        }
      }

      fixerArgs.dynamicNode = newList;
    }
  };

  #runGetter(getter: FunctionInterpolator, dynamicPartSpecifier: string) {
    pushReactiveContextStack({
      target: this,
      specifier: dynamicPartSpecifier,
    });
    const value = getter();
    popReactiveContextStack();
    return value;
  }
}

const templateCache = new Map<string, DocumentFragment>();

const safeHtml = __SSR__ ? createSSRTemplateFunction(false) : createTemplateFunction(false);
const safeHtmlWithKey = (stringsOrKey: TemplateKey, strings: TemplateStringsArray, ...values: unknown[]) => {
  const template = safeHtml(strings, ...values);
  !__SSR__ && template.setKey(stringsOrKey);
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
export const unsafeHtml = __SSR__ ? createSSRTemplateFunction(true) : createTemplateFunction(true);

function createTemplateFunction(isUnsafe: boolean) {
  return (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Template => {
    const { templateString, dynamicPartToGetterMap } = getTemplateMetadata(strings, values, isUnsafe);
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

export function getTemplateMetadata(strings: TemplateStringsArray, values: unknown[], isUnsafe: boolean) {
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
  return { templateString, dynamicPartToGetterMap };
}

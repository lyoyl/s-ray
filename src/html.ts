export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingRE = /\$\$--(.+?)--\$\$/g;

type FunctionInterpolator = (...args: any[]) => unknown;
type DynamicInterpolators = FunctionInterpolator | Template;

type Fixer = (...args: any[]) => void;

function isDynamicInterpolator(value: unknown): value is DynamicInterpolators {
  return isFuncInterpolator(value) || isTemplate(value);
}

function isFuncInterpolator(value: unknown): value is FunctionInterpolator {
  return typeof value === 'function';
}

function isTemplate(value: unknown): value is Template {
  return value instanceof Template;
}

function createTextNode(text: string) {
  return document.createTextNode(text);
}

function createComment(text: string) {
  return document.createComment(text);
}

export class Template {
  // The templates with same pattern should share the same DocumentFragment,
  // it is unparsed.
  originalDoc: DocumentFragment;
  // This is cloned from originalDoc and will be used to render the template,
  // it will be parsed by template parser.
  doc: DocumentFragment;

  // Keep track of the root nodes of the template's document fragment
  rootNodes: Node[] = [];

  dynamicPartToGetterMap: Map<string, DynamicInterpolators>;
  dynamicPartToFixerMap: Map<string, Fixer> = new Map();

  isInUse = false;

  constructor(originalDoc: DocumentFragment, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.originalDoc = originalDoc;
    this.doc = originalDoc.cloneNode(true) as DocumentFragment;
    this.rootNodes = Array.from(this.doc.childNodes);
    this.dynamicPartToGetterMap = dynamicPartToGetterMap;
    this.#parseTemplate(this.doc);
    this.dynamicPartToFixerMap.forEach(fixer => fixer());
  }

  clone() {
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
    return new Template(this.originalDoc, this.dynamicPartToGetterMap);
  }

  /**
   * When the template is switched out of the active DOM tree, we should recycle the root nodes
   * from the active DOM tree to the template's document fragment.
   */
  recycle() {
    this.rootNodes.forEach(node => this.doc.appendChild(node));
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
      const fixer = () => {
        const getter = this.dynamicPartToGetterMap.get(dynamicPartSpecifier);
        if (!isFuncInterpolator(getter)) {
          // TODO: add dev only error
          return;
        }
        attribute.ownerElement?.setAttribute(name, pattern.replace(dynamicPartSpecifier, String(getter())));
      };
      this.dynamicPartToFixerMap.set(dynamicPartSpecifier, fixer);
      m = bindingRE.exec(pattern);
    }
  }

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
    attribute.ownerElement?.addEventListener(eventName, handler);
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
    let nodes: Node[] = [];
    let dynamicNode: Text | Template = createTextNode('');
    let remainingTextNode: Text | null = null;
    if (texts[0] === '' && texts[1] === '') {
      // Which means the text is only the dynamic part specifier: 'dynamicPartSpecifier'
      nodes = [dynamicNode, anchorNode];
    } else if (texts[0] === '') {
      // Which means the dynamic part specifier is at the beginning of the text: 'dynamicPartSpecifier more static text'
      remainingTextNode = createTextNode(texts[1]);
      nodes = [dynamicNode, anchorNode, remainingTextNode];
    } else if (texts[1] === '') {
      // Which means the dynamic part specifier is at the end of the text: 'Static text dynamicPartSpecifier'
      nodes = [createTextNode(texts[0]), dynamicNode, anchorNode];
    } else {
      // Which means the dynamic part specifier is in the middle of the text: 'Static text dynamicPartSpecifier more static text'
      remainingTextNode = createTextNode(texts[1]);
      nodes = [createTextNode(texts[0]), dynamicNode, anchorNode, remainingTextNode];
    }

    text.replaceWith(...nodes);

    // Process the remaining text node recursively
    if (remainingTextNode) {
      this.#parseText(remainingTextNode);
    }

    const fixer = () => {
      const dynamicInterpolator = this.dynamicPartToGetterMap.get(dynamicPartSpecifier)!;
      const value = isFuncInterpolator(dynamicInterpolator) ? dynamicInterpolator() : dynamicInterpolator;
      if (isTemplate(dynamicNode)) {
        dynamicNode.recycle();
      } else {
        dynamicNode.remove();
      }
      if (isTemplate(value)) {
        const maybeCloned = value.isInUse ? value.clone() : value;
        dynamicNode = maybeCloned;
        anchorNode.parentNode!.insertBefore(maybeCloned.doc, anchorNode);
        /**
         * Mark it as in use, so that when the same template instance is used multiple times,
         * we can clone a new one
         */
        value.isInUse = true;
      } else {
        dynamicNode = createTextNode(String(value));
        anchorNode.parentNode!.insertBefore(dynamicNode, anchorNode);
      }
    };

    this.dynamicPartToFixerMap.set(dynamicPartSpecifier, fixer);
  }
}

const templateCache = new Map<string, Template>();

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
        dynamicPartToGetterMap.set(dynamicPartPlaceholder, value);
        return dynamicPartPlaceholder;
      }
      return value;
    }),
  );
  if (templateCache.has(templateString)) {
    const cachedTpl = templateCache.get(templateString)!;
    // We need to update the dynamic parts
    return new Template(cachedTpl.originalDoc, dynamicPartToGetterMap);
  }
  const template = document.createElement('template');
  template.innerHTML = templateString;
  const tpl = new Template(template.content, dynamicPartToGetterMap);
  templateCache.set(templateString, tpl);
  return tpl;
}

export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingRE = /\$\$--(.+?)--\$\$/g;

type PrimitiveInterpolators = string | number | boolean | null | undefined;
type FunctionInterpolator = (...args: any[]) => unknown;
type DynamicInterpolators = FunctionInterpolator | Template
type Interpolator = PrimitiveInterpolators | DynamicInterpolators;

type Fixer = (...args: any[]) => void;

function isDynamicInterpolator(value: Interpolator): value is DynamicInterpolators {
  return isFuncInterpolator(value) || value instanceof Template;
}

function isFuncInterpolator(value: Interpolator): value is FunctionInterpolator {
  return typeof value === 'function';
}

export class Template {
  // The templates with same pattern should share the same DocumentFragment,
  // it is unparsed.
  originalDoc: DocumentFragment;
  // This is cloned from originalDoc and will be used to render the template,
  // it will be parsed by template parser.
  doc: DocumentFragment;

  dynamicPartToGetterMap: Map<string, DynamicInterpolators>;
  dynamicPartToFixerMap: Map<string, Fixer> = new Map();

  constructor(originalDoc: DocumentFragment, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.originalDoc = originalDoc;
    this.doc = originalDoc.cloneNode(true) as DocumentFragment
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
    bindingRE.lastIndex = 0;
  }

  #parseEvent(attribute: Attr) {
    const name = attribute.name;
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      // TODO: throw error
      return;
    }
    const eventName = name.slice(1);
    const dynamicPartSpecifier = m[0];
    const handler = this.dynamicPartToGetterMap.get(dynamicPartSpecifier)
    if (!isFuncInterpolator(handler)) {
      // TODO: add dev only error
      return;
    }
    attribute.ownerElement?.addEventListener(eventName, handler);
    // remove the attribute
    attribute.ownerElement?.removeAttribute(name);

    // TODO: need cleanup mechanism

    bindingRE.lastIndex = 0;
  }

  #parseRef(attribute: Attr) {
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    if (!m) {
      // TODO: throw error
      return;
    }
    const dynamicPartSpecifier = m[0];
    const refSetter = this.dynamicPartToGetterMap.get(dynamicPartSpecifier)
    if (!isFuncInterpolator(refSetter)) {
      // TODO: add dev only error
      return;
    }
    refSetter(attribute.ownerElement);
    // TODO: need cleanup mechanism, and dev mode warning

    // remove the attribute
    attribute.ownerElement?.removeAttribute(attribute.name);
    bindingRE.lastIndex = 0;
  }

  #parseText(text: Text) {
    const content = text.nodeValue || '';
    let m = bindingRE.exec(content);
    while (m) {
      const dynamicPartSpecifier = m[0];
      const fixer = () => {
        const getter = this.dynamicPartToGetterMap.get(dynamicPartSpecifier);
        if (!isFuncInterpolator(getter)) {
          // TODO: add dev only error
          return;
        }
        // TODO: only set nodeValue once
        text.nodeValue = text.nodeValue!.replace(dynamicPartSpecifier, String(getter()));
      };
      this.dynamicPartToFixerMap.set(dynamicPartSpecifier, fixer);
      m = bindingRE.exec(content);
    }
    bindingRE.lastIndex = 0;
  }
}

const templateCache = new Map<string, Template>();

export function html(
  strings: TemplateStringsArray,
  ...values: Interpolator[]
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

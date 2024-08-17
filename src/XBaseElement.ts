import { bindingRE } from './html';

type Fixer = (newValue: string) => void;

type Bindings = Map<string, Map<Attr | Text, Fixer>>;

export class XBaseElement extends HTMLElement {
  [key: string]: any;

  constructor(template: DocumentFragment) {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.appendChild(template.cloneNode(true));
  }

  connectedCallback() {
    this.#parseTemplate(this.shadowRoot!);
    this.#render();
  }

  #bindings: Bindings = new Map();

  #parseTemplate(template: DocumentFragment) {
    this.#parseNodes(template.childNodes);
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
    }

    const pattern = attribute.value;
    let m = bindingRE.exec(pattern);
    while (m) {
      const bindingName = m[1];
      const fixer = (newValue: string) => {
        attribute.ownerElement?.setAttribute(name, pattern.replaceAll(bindingRE, newValue));
      };
      if (!this.#bindings.has(bindingName)) {
        this.#bindings.set(bindingName, new Map());
      }
      if (!this.#bindings.get(bindingName)!.has(attribute)) {
        this.#bindings.get(bindingName)!.set(attribute, fixer);
      }
      m = bindingRE.exec(pattern);
    }
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
    const methodName = m[1];
    const method = this[methodName];
    attribute.ownerElement?.addEventListener(eventName, method);
    // TODO: need cleanup mechanism
  }

  #parseText(text: Text) {
  }

  #render() {
    this.#bindings.forEach((_, bindingName) => {
      this.render(bindingName, this[bindingName]);
    });
  }

  render(bindingName: string, newValue: any) {
    const fixers = this.#bindings.get(bindingName);
    if (!fixers) {
      return;
    }
    fixers.forEach((fixer) => fixer(newValue));
  }
}

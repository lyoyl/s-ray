import { bindingRE } from "./html";

type Fixer = (newValue: string) => void;

type Bindings = Map<string, Map<Attr | Text, Fixer>>;

export class XBaseElement extends HTMLElement {
  [key: string]: any;

  constructor(template: DocumentFragment) {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.appendChild(template.cloneNode(true));
    this.#parseTemplate(this.shadowRoot!);

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
    const pattern = attribute.value;
    let m = bindingRE.exec(pattern)
    while(m) {
      const bindingName = m[1];
      const fixer = (newValue: string) => {
        console.log(attribute.ownerElement)
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
    console.log(this.#bindings);
  }

  #parseText(text: Text) {

  }

  render(bindingName: string, newValue: any) {
    const fixers = this.#bindings.get(bindingName);
    if (!fixers) {
      return;
    }
    fixers.forEach((fixer) => fixer(newValue));
  }
}

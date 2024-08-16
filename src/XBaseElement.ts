export class XBaseElement extends HTMLElement {

  constructor(template: DocumentFragment) {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.appendChild(template.cloneNode(true));
  }
}
export class XBaseElement extends HTMLElement {
  [key: string]: any;

  constructor(template: DocumentFragment) {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.appendChild(template.cloneNode(true));
  }

  render() {
    console.log('render');
  }
}

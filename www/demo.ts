import { XBaseElement, XCondition, binding, html } from '../src/index';

customElements.define('x-condition', XCondition);

const template = html<MyApp>`
  <button @click="${'handleClick'}">Toggle</button>

  <x-condition ${'hidden'} current="${'currentView'}">
    <h1 slot="foo" ref="${'titleEl'}">Hello, World! ${'desc'} AAAAA</h1>
    <h1 slot="bar">Goodbye, World! BBBBB</h1>
  </x-condition>
`;

class MyApp extends XBaseElement {
  @binding
  currentView: 'foo' | 'bar' = 'foo';

  titleEl!: HTMLHeadingElement;

  @binding
  desc = 'This is a description.';

  constructor() {
    super(template);
  }

  connectedCallback() {
    const toggleButton = this.shadowRoot!.querySelector('button')!;
    toggleButton.addEventListener('click', this.handleClick);
  }

  handleClick = () => {
    this.currentView = this.currentView === 'foo' ? 'bar' : 'foo';
  };
}

customElements.define('my-app', MyApp);

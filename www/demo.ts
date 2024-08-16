import { XBaseElement, XCondition, html, observable } from '../src/index';

customElements.define('x-condition', XCondition);

const template = html`
  <button>Toggle</button>

  <x-condition $current="currentView">
    <h1 slot="foo">Hello, World! <x>bar</x> AAAAA</h1>
    <h1 slot="bar">Goodbye, World! BBBBB</h1>
  </x-condition>
`;

class MyApp extends XBaseElement {
  @observable
  currentView: 'foo' | 'bar' = 'foo';

  constructor() {
    super(template);
  }

  connectedCallback() {
    const toggleButton = this.shadowRoot!.querySelector('button')!;
    const condition = this.shadowRoot!.querySelector<XCondition>('x-condition')!;

    toggleButton.addEventListener('click', () => {
      condition.current = condition.current === 'foo' ? 'bar' : 'foo';
    });
  }
}

customElements.define('my-app', MyApp);

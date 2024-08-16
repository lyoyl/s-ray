import { html, XBaseElement, XCondition } from '../src/index';

customElements.define('x-condition', XCondition);

// const toggleButton = document.querySelector('button')!;
// const condition = document.querySelector<XCondition>('x-condition')!;

// toggleButton.addEventListener('click', () => {
//   condition.current = condition.current === 'foo' ? 'bar' : 'foo';
// });

const template = html`
  <button>Toggle</button>

  <x-condition current="{{ foo }}">
    <h1 slot="foo">Hello, World! {{ name }} AAAAA</h1>
    <h1 slot="bar">Goodbye, World! BBBBB</h1>
  </x-condition>
`; 

class MyApp extends XBaseElement {
  constructor() {
    super(template);
  }

  
}

customElements.define('my-app', MyApp);
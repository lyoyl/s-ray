import { SBaseElement, SCondition, computed, defineElement, html, reactive } from '../src/index.js';

customElements.define('s-condition', SCondition);

const template = html<MyApp>`
  <button @click="${'handleClick'}">Toggle</button>

  <h4>${'currentViewText'}----------------</h4>

  <h4>${'currentViewTextPlus'}</h4>

  <s-condition current="${'currentView'}">
    <h1 slot="foo" ref="${'titleEl'}">Hello, World! ${'desc'} AAAAA</h1>
    <h1 slot="bar">Goodbye, World! BBBBB</h1>
  </s-condition>

  <button @click="${'handleButtonClick'}">${'double'}</button>
  <h3>Triple: ${'triple'}</h3>
`;

@defineElement({
  template,
})
class MyApp extends SBaseElement {
  @reactive
  currentView: 'foo' | 'bar' = 'foo';

  titleEl!: HTMLHeadingElement;

  @reactive
  desc = 'This is a description.';

  @reactive
  counter = 1;

  @computed
  get double() {
    return this.counter * 2;
  }

  @computed
  get triple() {
    return this.counter * 3;
  }

  @computed
  get currentViewText() {
    return this.currentView + this.desc;
  }

  @computed
  get currentViewTextPlus() {
    return this.currentView === 'foo'
      ? this.currentViewText + 'foo'
      : this.currentViewText + this.desc + 'bar';
  }

  connectedCallback() {
    super.connectedCallback();
    setInterval(() => {
      this.desc = 'This is a new description.' + Math.random();
    }, 1000);
  }

  handleClick = () => {
    this.currentView = this.currentView === 'foo' ? 'bar' : 'foo';
  };

  handleButtonClick = () => {
    this.counter++;
  };
}

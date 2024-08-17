import { XBaseElement, XCondition, binding, computed, defineElement, html } from '../src/index';

customElements.define('x-condition', XCondition);

const template = html<MyApp>`
  <button @click="${'handleClick'}">Toggle</button>

  <h4>${'currentViewText'}----------------</h4>

  <h4>${'currentViewTextPlus'}</h4>

  <x-condition current="${'currentView'}">
    <h1 slot="foo" ref="${'titleEl'}">Hello, World! ${'desc'} AAAAA</h1>
    <h1 slot="bar">Goodbye, World! BBBBB</h1>
  </x-condition>
`;

@defineElement({
  template,
})
class MyApp extends XBaseElement {
  @binding
  currentView: 'foo' | 'bar' = 'foo';

  titleEl!: HTMLHeadingElement;

  @binding
  desc = 'This is a description.';

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
}

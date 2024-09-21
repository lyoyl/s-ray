import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';
import { defineElement } from '../defineElement.js';
import { domRef } from '../domRef.js';
import { html } from '../html.js';
import { onConnected, onDisconnected } from '../lifecycle.js';
import { computed, ref } from '../reactive.js';
import { nextTick } from '../scheduler.js';

const fakeFooterClickHandler = fake();
const fakeOnConnectedOfMyComponent = fake();
const fakeOnDisconnectedOfMyComponent = fake();

defineElement({
  name: 'my-button',
  setup() {
    return {
      template: html`
        <button ?disabled=${() => true}>
          <slot></slot>
        </button>
      `,
    };
  },
});

defineElement({
  name: 'my-component',
  setup() {
    const state = ref(0);
    const double = computed(() => state.value * 2);

    onConnected(fakeOnConnectedOfMyComponent);
    onDisconnected(fakeOnDisconnectedOfMyComponent);

    return {
      template: html`
        <p>State: ${() => state.value}</p>
        <p>Double: ${() => double.value}</p>
        <button @click=${() => state.value++}>Increment</button>

        <my-button>Click me</my-button>
      `,
    };
  },
});

defineElement({
  name: 'my-app',
  setup() {
    const data = ref([
      { id: 1, name: 'Apple' },
      { id: 2, name: 'Banana' },
      { id: 3, name: 'Cherry' },
    ]);

    function renderList() {
      return data.value.map(item =>
        html(item.id)`
          <li data-id=${() => item.id} :prop=${() => item.name}>Name: ${() => item.name}; ID: ${() => item.id}</li>
          <input />
        `
      );
    }

    function handleClick() {
      data.value = [
        { id: 2, name: 'Banana' },
        { id: 4, name: 'Durian' },
        { id: 1, name: 'Apple' },
      ];
    }

    const buttonEl = domRef();

    const footer = html`<footer @click=${fakeFooterClickHandler}>footer</footer>`;

    return {
      template: html`
        <button ${buttonEl} @click=${handleClick}>Update</button>
        <ul>
          ${renderList}
          <my-component></my-component>
          ${footer}
        </ul>
      `,
    };
  },
});

describe('hydrating', () => {
  it('should hydrate all components', async () => {
    expect(fakeOnConnectedOfMyComponent.callCount).to.equal(1);

    const myApp = document.querySelector('my-app')!;
    expect(myApp.shadowRoot!.innerHTML).to.equal(`
    <!--[0--->
      <button>Update</button>
      <ul>
        <!--[[1-2--><!--[2--->
        <li data-id="1">Name: <!--%0-2-->Apple<!--0-2%--><!--^-->; ID: <!--%1-3-->1<!--1-3%--><!--^--></li>
        <input>
      <!--2-]--><!--[3--->
        <li data-id="2">Name: <!--%2-2-->Banana<!--2-2%--><!--^-->; ID: <!--%3-3-->2<!--3-3%--><!--^--></li>
        <input>
      <!--3-]--><!--[4--->
        <li data-id="3">Name: <!--%4-2-->Cherry<!--4-2%--><!--^-->; ID: <!--%5-3-->3<!--5-3%--><!--^--></li>
        <input>
      <!--4-]--><!--1-2]]--><!--^-->
        <my-component></my-component>
        <!--[7-3--><footer>footer</footer><!--7-3]--><!--^-->
      </ul>
    <!--0-]-->
      `.trim());

    const myComponent = myApp.shadowRoot!.querySelector('my-component')!;
    expect(myComponent.shadowRoot!.innerHTML).to.equal(`
    <!--[5--->
      <p>State: <!--%6-0-->0<!--6-0%--><!--^--></p>
      <p>Double: <!--%7-1-->0<!--7-1%--><!--^--></p>
      <button>Increment</button>

      <my-button>Click me</my-button>
    <!--5-]-->`.trim());

    const myButton = myComponent.shadowRoot!.querySelector('my-button')!;
    expect(myButton.shadowRoot!.innerHTML).to.equal(`
    <!--[6--->
      <button disabled="">
        <slot></slot>
      </button>
    <!--6-]-->`.trim());

    const incrementButton = myComponent.shadowRoot!.querySelector('button')!;
    incrementButton.click();
    await nextTick();

    expect(myComponent.shadowRoot!.innerHTML).to.equal(`
    <!--[5--->
      <p>State: <!--%6-0--><!--6-0%-->1<!--^--></p>
      <p>Double: <!--%7-1--><!--7-1%-->2<!--^--></p>
      <button>Increment</button>

      <my-button>Click me</my-button>
    <!--5-]-->`.trim());

    const updateButton = myApp.shadowRoot!.querySelector('button')!;
    updateButton.click();
    await nextTick();

    expect(myApp.shadowRoot!.innerHTML).to.equal(`
    <!--[0--->
      <button>Update</button>
      <ul>
        <!--[[1-2--><!--[3--->
        <li data-id="2">Name: <!--%2-2-->Banana<!--2-2%--><!--^-->; ID: <!--%3-3-->2<!--3-3%--><!--^--></li>
        <input>
      <!--3-]--><!--[-->
          <li data-id="4">Name: Durian<!--^-->; ID: 4<!--^--></li>
          <input>
        <!--]--><!--[2--->
        <li data-id="1">Name: <!--%0-2-->Apple<!--0-2%--><!--^-->; ID: <!--%1-3-->1<!--1-3%--><!--^--></li>
        <input>
      <!--2-]--><!--1-2]]--><!--^-->
        <my-component></my-component>
        <!--[7-3--><footer>footer</footer><!--7-3]--><!--^-->
      </ul>
    <!--0-]-->`.trim());

    const footer = myApp.shadowRoot!.querySelector('footer')!;
    footer.click();
    expect(fakeFooterClickHandler.callCount).to.equal(1);

    myApp.remove();
    expect(fakeOnDisconnectedOfMyComponent.callCount).to.equal(1);
  });
});

import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';

import {
  ElementInstance,
  defineBooleanAttr,
  defineElement,
  defineNumberAttr,
  defineStringAttr,
} from './defineElement.js';
import { html } from './html.js';
import { ref, watch } from './reactive.js';
import { nextTick } from './scheduler.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('defineElement', () => {
  it('Basic usage', async () => {
    const cb = fake();

    defineElement({
      name: 'my-app',
      setup() {
        const counter = ref(0);

        watch(counter, cb);

        return {
          template: html`
            <div>
              <button @click=${() => counter.value++}>Increment</button>
              <span>${() => counter.value}</span>
            </div>
          `,
        };
      },
    });

    const el = document.createElement('my-app');
    document.body.appendChild(el);

    const button = el.shadowRoot!.querySelector('button')!;
    button.click();
    await nextTick();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(1);
    expect(cb.firstCall.args[1]).to.equal(0);
    expect(cb.firstCall.args[2]).to.be.a('function');
    expect(el.shadowRoot!.querySelector('span')!.textContent).to.equal('1');
    cb.resetHistory();

    el.remove();
    button.click();
    await nextTick();
    expect(cb.callCount).to.equal(0);
  });

  it('the first argument of the setup() function is the host element itself', async () => {
    let hostEl;
    const MyElement = defineElement({
      name: 'my-element',
      setup(hostElement) {
        hostEl = hostElement;
        return {
          template: html``,
        };
      },
    });

    const myEl = new MyElement();
    document.body.appendChild(myEl);
    expect(hostEl).to.equal(myEl);
  });

  it('defineBooleanAttr() - should be working as expected', async () => {
    const boolDsiabled = defineBooleanAttr('disabled', false);
    const boolSelected = defineBooleanAttr('selected', true);

    const MyElement1 = defineElement({
      name: 'my-element1',
      attrs: [boolDsiabled, boolSelected] as const,
      setup() {
        return {
          template: html``,
        };
      },
    });

    const el = document.createElement('my-element1') as InstanceType<typeof MyElement1>;
    document.body.appendChild(el);
    // default values should be set
    expect(el.outerHTML).to.equal(`<my-element1 selected=""></my-element1>`);

    el.selected = false;
    el.disabled = true;
    expect(el.outerHTML).to.equal(`<my-element1 disabled=""></my-element1>`);

    // remove the disabled attribute
    el.removeAttribute('disabled');
    expect(el.disabled).to.equal(false);

    // set the selected attribute
    el.setAttribute('selected', '');
    expect(el.selected).to.equal(true);
  });

  it('defineNumberAttr() - should be working as expected', async () => {
    const myAttr = defineNumberAttr('my-attr', 0);

    const MyElement2 = defineElement({
      name: 'my-element2',
      attrs: [myAttr] as const,
      setup() {
        return {
          template: html``,
        };
      },
    });

    const el = document.createElement('my-element2') as InstanceType<typeof MyElement2>;
    document.body.appendChild(el);
    // default values should be set
    expect(el.outerHTML).to.equal(`<my-element2 my-attr="0"></my-element2>`);

    el.myAttr = 12;
    expect(el.outerHTML).to.equal(`<my-element2 my-attr="12"></my-element2>`);

    // remove the attribute
    el.removeAttribute('my-attr');
    expect(el.myAttr).to.equal(0); // default value

    // set the attribute
    el.setAttribute('my-attr', '24');
    expect(el.myAttr).to.equal(24);
  });

  it('defineStringAttr() - should be working as expected', async () => {
    const myAttr = defineStringAttr('my-attr', 'big');

    const MyElement2 = defineElement({
      name: 'my-element3',
      attrs: [myAttr] as const,
      setup() {
        return {
          template: html``,
        };
      },
    });

    const el = document.createElement('my-element3') as InstanceType<typeof MyElement2>;
    document.body.appendChild(el);
    // default values should be set
    expect(el.outerHTML).to.equal(`<my-element3 my-attr="big"></my-element3>`);

    el.myAttr = 'small';
    expect(el.outerHTML).to.equal(`<my-element3 my-attr="small"></my-element3>`);

    // remove the attribute
    el.removeAttribute('my-attr');
    expect(el.myAttr).to.equal('big'); // default value

    // set the attribute
    el.setAttribute('my-attr', 'small');
    expect(el.myAttr).to.equal('small');
  });

  it('properties added via define*Attr() should be reactive', async () => {
    const myAttr = defineNumberAttr('my-attr', 0);

    const MyElement = defineElement({
      name: 'my-element4',
      attrs: [myAttr] as const,
      setup(hostElement) {
        return {
          template: html`${() => hostElement.myAttr}`,
        };
      },
    });

    const el = document.createElement('my-element4') as InstanceType<typeof MyElement>;
    document.body.appendChild(el);
    expect(el.myAttr).to.equal(0);
    expect(el.shadowRoot!.textContent).to.equal('0');

    el.myAttr = 12;
    await nextTick();
    expect(el.shadowRoot!.textContent).to.equal('12');

    el.setAttribute('my-attr', '24');
    await nextTick();
    expect(el.myAttr).to.equal(24);
  });
});

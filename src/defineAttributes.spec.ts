import { expect } from '@esm-bundle/chai';

import { defineBooleanAttr, defineNumberAttr, defineStringAttr } from './defineAttributes.js';
import { defineElement } from './defineElement.js';
import { defineProperty } from './defineProperty.js';
import { html } from './html.js';
import { computed } from './reactive.js';
import { nextTick } from './scheduler.js';

describe('defineAttributes', () => {
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

  it('should work with custom elements', async () => {
    const MyComp = defineElement({
      name: 'my-comp',
      attrs: [
        defineBooleanAttr('disabled', false),
        defineNumberAttr('value', 1),
        defineStringAttr('name', ''),
      ] as const,
      props: [
        defineProperty('data', { default: 0 }),
      ] as const,
      setup(hostElement) {
        const double = computed(() => hostElement.value * 2);

        return {
          template: html`
            <p>Is diabled: ${() => hostElement.disabled}</p>
            <p>Double: ${() => double.value}</p>
            <p>Name: ${() => hostElement.name}-hcy</p>
            <p>Data: ${() => JSON.stringify(hostElement.data)}</p>
          `,
        };
      },
    });

    const MyApp = defineElement({
      name: 'my-app2',
      setup() {
        return {
          template: html`
            <my-comp>This one should use default values</my-comp>
            <my-comp disabled value="10" name="hcy" :data=${() => ({ default: 1 })}></my-comp>
          `,
        };
      },
    });

    const el = document.createElement('my-app2') as InstanceType<typeof MyApp>;
    document.body.appendChild(el);

    const myComps = el.shadowRoot!.querySelectorAll<InstanceType<typeof MyComp>>('my-comp')!;
    expect(myComps[0].disabled).to.equal(false);
    expect(myComps[0].getAttribute('disabled')).to.equal(null);
    expect(myComps[0].value).to.equal(1);
    expect(myComps[0].getAttribute('value')).to.equal('1');
    expect(myComps[0].name).to.equal('');
    expect(myComps[0].getAttribute('name')).to.equal('');

    expect(myComps[1].disabled).to.equal(true);
    expect(myComps[1].getAttribute('disabled')).to.equal('');
    expect(myComps[1].value).to.equal(10);
    expect(myComps[1].getAttribute('value')).to.equal('10');
    expect(myComps[1].name).to.equal('hcy');
    expect(myComps[1].getAttribute('name')).to.equal('hcy');
  });
});

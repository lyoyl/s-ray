import { expect } from '@esm-bundle/chai';

import { css } from '../css.js';
import { defineBooleanAttr, defineNumberAttr, defineStringAttr } from '../defineAttributes.js';
import { defineElement } from '../defineElement.js';
import { defineProperty } from '../defineProperty.js';
import { domRef } from '../domRef.js';
import { html, unsafeHtml } from '../html.js';
import { computed, ref } from '../reactive.js';

describe('SSR', function() {
  it('render to string, attribute, boolean attribute, event binding, ref, property binding', async () => {
    const MyButton = defineElement({
      name: 'my-button',
      setup() {
        const disabled = ref(true);
        const normal = ref('normal');

        const btnEl = domRef();

        return {
          template: html`
            <div>
              <button
                normal-attr=${() => normal.value}
                :disabled=${() => disabled.value}
                @click=${() => disabled.value = !disabled.value}
                ?boolean-attr=${() => disabled.value}
                ${btnEl}
              >
                <slot></slot>
              </button>
            </div>
          `,
        };
      },
    });

    const myButton = new MyButton();
    myButton.connectedCallback();

    expect(myButton.toString()).to.equal(`
<template shadowrootmode="open"><!--[0--->
            <div>
              <button #normal-attr="$$--dynamic0--$$" normal-attr="normal" :disabled="$$--dynamic1--$$" @click="$$--dynamic2--$$" ?boolean-attr="$$--dynamic3--$$" boolean-attr ref="$$--dynamic4--$$">
                <slot></slot>
              </button>
            </div>
          <!--0-]--></template>
    `.trim());
  });

  it('render to string, attribute, boolean attribute, property binding - made by multiple parts', async () => {
    const MyButton = defineElement({
      name: 'my-button2',
      setup() {
        const disabled = ref(true);
        const normal = ref('normal');

        return {
          template: html`
            <div>
              <button
                normal-attr='staticvalue ${() => normal.value}'
                ?disabled="${() => disabled.value}"
                :prop="prev ${() => normal.value} ${() => disabled.value} another"
                ?boolean-attr="bar ${() => disabled.value} foo"
              >
                <slot></slot>
              </button>
            </div>
          `,
        };
      },
    });

    const myButton = new MyButton();
    myButton.connectedCallback();

    expect(myButton.toString()).to.equal(`
<template shadowrootmode="open"><!--[1--->
            <div>
              <button #normal-attr="staticvalue $$--dynamic0--$$" normal-attr="staticvalue normal" ?disabled="$$--dynamic1--$$" disabled :prop="prev $$--dynamic2--$$ $$--dynamic3--$$ another" ?boolean-attr="bar $$--dynamic4--$$ foo" boolean-attr>
                <slot></slot>
              </button>
            </div>
          <!--1-]--></template>
    `.trim());
  });

  it('nested elements', async () => {
    const MyButton = defineElement({
      name: 'my-button3',
      setup() {
        const disabled = ref(true);
        const normal = ref('normal');

        return {
          template: html`
            <div>
              <button
                normal-attr='staticvalue ${() => normal.value}'
                ?disabled="${() => disabled.value}"
                id="my-button"
              >
                <slot></slot>
              </button>
            </div>
          `,
        };
      },
    });

    const MyComponent = defineElement({
      name: 'my-component2',
      setup() {
        const state = ref(1);
        const double = computed(() => state.value * 2);

        return {
          template: html`
            <p>State: ${() => state.value}</p>
            <p>Double: ${() => double.value}</p>
            <button @click=${() => state.value++}>Increment</button>
            <my-button3>
              <span>Click me</span>
            </my-button3>
          `,
        };
      },
    });

    const myComponent = new MyComponent();
    myComponent.connectedCallback();

    expect(myComponent.toString()).to.equal(`
<template shadowrootmode="open"><!--[2--->
            <p>State: <!--%0-0-->1<!--0-0%--><!--^--></p>
            <p>Double: <!--%1-1-->2<!--1-1%--><!--^--></p>
            <button @click="$$--dynamic2--$$">Increment</button>
            <my-button3><template shadowrootmode="open"><!--[3--->
            <div>
              <button #normal-attr="staticvalue $$--dynamic0--$$" normal-attr="staticvalue normal" ?disabled="$$--dynamic1--$$" disabled id="my-button">
                <slot></slot>
              </button>
            </div>
          <!--3-]--></template>
              <span>Click me</span>
            </my-button3>
          <!--2-]--></template>
    `.trim());
  });

  it('custom element with bindings', async () => {
    defineElement({
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

    const myApp = new MyApp();
    myApp.connectedCallback();

    expect(myApp.toString()).to.equal(`
<template shadowrootmode="open"><!--[4--->
            <my-comp><template shadowrootmode="open"><!--[5--->
            <p>Is diabled: <!--%2-0-->false<!--2-0%--><!--^--></p>
            <p>Double: <!--%3-1-->2<!--3-1%--><!--^--></p>
            <p>Name: <!--%4-2--> <!--4-2%--><!--^-->-hcy</p>
            <p>Data: <!--%5-3-->{&quot;default&quot;:0}<!--5-3%--><!--^--></p>
          <!--5-]--></template>This one should use default values</my-comp>
            <my-comp disabled value="10" name="hcy" :data="$$--dynamic0--$$"><template shadowrootmode="open"><!--[6--->
            <p>Is diabled: <!--%6-0-->true<!--6-0%--><!--^--></p>
            <p>Double: <!--%7-1-->20<!--7-1%--><!--^--></p>
            <p>Name: <!--%8-2-->hcy<!--8-2%--><!--^-->-hcy</p>
            <p>Data: <!--%9-3-->{&quot;default&quot;:1}<!--9-3%--><!--^--></p>
          <!--6-]--></template></my-comp>
          <!--4-]--></template>
    `.trim());
  });

  it('render unsafe html', async () => {
    const MyComponent = defineElement({
      name: 'my-component3',
      setup() {
        const htmlFromProvider = '<span>Unsafe content</span>';
        const safeContent = html`${htmlFromProvider}`;
        const unsafeContent = unsafeHtml`${htmlFromProvider}`;

        return {
          template: html`
            <div>${safeContent}</div>
            <div>${unsafeContent}</div>
          `,
        };
      },
    });

    const myComponent = new MyComponent();
    myComponent.connectedCallback();

    expect(myComponent.toString()).to.equal(`
<template shadowrootmode="open"><!--[7--->
            <div><!--[8-0-->&lt;span&gt;Unsafe content&lt;/span&gt;<!--8-0]--><!--^--></div>
            <div><!--[9-1--><span>Unsafe content</span><!--9-1]--><!--^--></div>
          <!--7-]--></template>
    `.trim());
  });

  it('render styles - inlined', async () => {
    const MyComponent = defineElement({
      name: 'my-component4',
      styles: [
        css`.foo { color: red; }`,
        css`div { background: blue; }`,
      ],
      setup() {
        return {
          template: html`
            <div class="foo">Hello</div>
          `,
        };
      },
    });

    const myComponent = new MyComponent();
    myComponent.connectedCallback();

    expect(myComponent.toString()).to.equal(`
<template shadowrootmode="open"><style>.foo { color: red; }div { background: blue; }</style><!--[10--->
            <div class="foo">Hello</div>
          <!--10-]--></template>
    `.trim());
  });
});

import { expect } from '@esm-bundle/chai';

import { defineElement } from '../defineElement.js';
import { domRef } from '../domRef.js';
import { html } from '../html.js';
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
<template shadowrootmode="open">
<!--[0-->
            <div>
              <button normal-attr="normal" :disabled="$$--dynamic1--$$" @click="$$--dynamic2--$$" ?boolean-attr="$$--dynamic3--$$" boolean-attr ref="$$--dynamic4--$$">
                <slot></slot>
              </button>
            </div>
          <!--0]-->
</template>
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
<template shadowrootmode="open">
<!--[1-->
            <div>
              <button normal-attr="staticvalue normal" ?disabled="$$--dynamic1--$$" disabled :prop="prev $$--dynamic2--$$ $$--dynamic3--$$ another" ?boolean-attr="bar $$--dynamic4--$$ foo" boolean-attr>
                <slot></slot>
              </button>
            </div>
          <!--1]-->
</template>
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
<template shadowrootmode="open">
<!--[2-->
            <p>State: 1</p>
            <p>Double: 2</p>
            <button @click="$$--dynamic2--$$">Increment</button>
            <my-button3><template shadowrootmode="open">
<!--[3-->
            <div>
              <button normal-attr="staticvalue normal" ?disabled="$$--dynamic1--$$" disabled :prop="prev $$--dynamic2--$$ $$--dynamic3--$$ another" ?boolean-attr="bar $$--dynamic4--$$ foo" boolean-attr>
                <slot></slot>
              </button>
            </div>
          <!--3]-->
</template>
              <span>Click me</span>
            </my-button3>
          <!--2]-->
</template>
    `.trim());
  });
});

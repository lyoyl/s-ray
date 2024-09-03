import { expect } from '@esm-bundle/chai';

import { css } from './css.js';
import { defineBooleanAttr, defineNumberAttr, defineStringAttr } from './defineAttributes.js';
import { defineElement } from './defineElement.js';
import { html } from './html.js';
import { nextTick } from './scheduler.js';

describe('css()', () => {
  it('basic usage', async () => {
    const style = css`
      div {
        color: red;
      }
      button {
        color: blue;
      }
    `;

    const MyElement1 = defineElement({
      name: 'my-element1',
      styles: [style],
      setup() {
        return {
          template: html`
            <div>color</div>
            <button>click me</button>
          `,
        };
      },
    });

    const myElement1 = new MyElement1();
    document.body.appendChild(myElement1);
    expect(getComputedStyle(myElement1.shadowRoot!.querySelector('div')!).color).to.equal('rgb(255, 0, 0)');
    expect(getComputedStyle(myElement1.shadowRoot!.querySelector('button')!).color).to.equal('rgb(0, 0, 255)');
  });
});

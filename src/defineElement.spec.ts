import { expect } from '@esm-bundle/chai';
import { fake, useFakeTimers } from 'sinon';

import { defineElement } from './defineElement.js';
import { html } from './html.js';
import { ref, watch } from './reactive.js';
import { nextTick } from './scheduler.js';

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
});

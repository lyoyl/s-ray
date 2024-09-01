import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';

import { defineElement } from './defineElement.js';
import { html } from './html.js';
import { onConnected, onDisconnected } from './lifecycle.js';

describe('lifecycles', () => {
  it('onConnected & onDisconnected', async () => {
    const connectedCb = fake();
    const disconnectedCb = fake();
    const MyApp = defineElement({
      name: 'my-app',
      setup() {
        onConnected(connectedCb);
        onDisconnected(disconnectedCb);

        return {
          template: html``,
        };
      },
    });

    const el = new MyApp();
    document.body.appendChild(el);
    expect(connectedCb.callCount).to.equal(1);
    expect(disconnectedCb.callCount).to.equal(0);

    el.remove();
    expect(connectedCb.callCount).to.equal(1);
    expect(disconnectedCb.callCount).to.equal(1);
  });
});

import { expect } from '@esm-bundle/chai';
import { getHostElement } from './composables.js';
import { defineElement } from './defineElement.js';
import { html } from './html.js';

describe('Composables', () => {
  it('getHostElement() should work as expected', async () => {
    let hostEl;
    const MyElement = defineElement({
      name: 'my-element',
      setup() {
        hostEl = getHostElement();

        return {
          template: html``,
        };
      },
    });

    const myEl = new MyElement();
    document.body.appendChild(myEl);
    expect(hostEl).to.equal(myEl);
  });
});

import { expect } from '@esm-bundle/chai';

import { defineElement } from './defineElement.js';
import { defineProperty } from './defineProperty.js';
import { html } from './html.js';
import { nextTick } from './scheduler.js';

describe('defineProperty', () => {
  it('defineProperty() - should be working as expected', async () => {
    const myProp1 = defineProperty('myProp1');
    const myProp2 = defineProperty('myProp2', 10);

    const MyApp = defineElement({
      name: 'my-app',
      props: [myProp1, myProp2] as const,
      setup(hostElement) {
        return {
          template: html`
            <div>
              <span>${() => hostElement.myProp1}</span>
              <span>${() => hostElement.myProp2}</span>
            </div>
          `,
        };
      },
    });

    const el = new MyApp();
    document.body.appendChild(el);
    expect(el.shadowRoot!.querySelectorAll('span')[0].textContent).to.equal('undefined');
    expect(el.shadowRoot!.querySelectorAll('span')[1].textContent).to.equal('10');

    el.myProp1 = 'Hello';
    el.myProp2 = 20;
    await nextTick();
    expect(el.shadowRoot!.querySelectorAll('span')[0].textContent).to.equal('Hello');
    expect(el.shadowRoot!.querySelectorAll('span')[1].textContent).to.equal('20');
  });
});

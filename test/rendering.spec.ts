import { expect } from '@esm-bundle/chai';
import { sendMouse } from '@web/test-runner-commands';
import { fake, restore } from 'sinon';
import { SBaseElement, defineElement, html } from '../src/index.js';
import { fixture, getMiddleOfElement } from './test-utils.js';

beforeEach(() => {
  restore();
});

describe('Rendering', () => {
  it('Text rendering', () => {
    @defineElement({
      template: html<MyComp>`
        <h1>I am text, ${'text'} !!! ${'text'}</h1>
      `,
    })
    class MyComp extends SBaseElement {
      text = 'Hello, World';
    }

    const cleanup = fixture('<my-comp></my-comp>');

    const myComp = document.querySelector<MyComp>('my-comp')!;
    expect(myComp.shadowRoot!.querySelector('h1')!.textContent).to.equal('I am text, Hello, World !!! Hello, World');

    cleanup();
  });

  it('Attribute rendering', () => {
    @defineElement({
      template: html<MyComp2>`
        <h1 id="${'uniqueId'}" class="${'customCls'} foo bar"></h1>
      `,
    })
    class MyComp2 extends SBaseElement {
      uniqueId = 'my-id';
      customCls = 'custom-cls1 custom-cls2';
    }

    const cleanup = fixture('<my-comp2></my-comp2>');

    const myComp = document.querySelector<MyComp2>('my-comp2')!;
    const h1 = myComp.shadowRoot!.querySelector('h1')!;
    expect(h1.id).to.equal('my-id');
    expect(h1.className).to.equal('custom-cls1 custom-cls2 foo bar');

    cleanup();
  });

  it('Event binding', async () => {
    @defineElement({
      template: html<MyComp3>`
        <button @click="${'handleClick'}">Click me</button>
      `,
    })
    class MyComp3 extends SBaseElement {
      handleClick = fake();
    }

    const cleanup = fixture('<my-comp3></my-comp3>');

    const myComp = document.querySelector<MyComp3>('my-comp3')!;
    const { x, y } = getMiddleOfElement(myComp.shadowRoot!.querySelector('button')!);
    await sendMouse({ type: 'click', position: [x, y] });
    expect(myComp.handleClick.calledOnce).to.be.true;

    cleanup();
  });

  it('Should work with ref', () => {
    @defineElement({
      template: html<MyComp4>`
        <button ref=${'buttonEl'}>Click me</button>
      `,
    })
    class MyComp4 extends SBaseElement {
      buttonEl!: HTMLButtonElement;
    }

    const cleanup = fixture('<my-comp4></my-comp4>');

    const myComp = document.querySelector<MyComp4>('my-comp4')!;
    expect(myComp.buttonEl).to.be.instanceOf(HTMLButtonElement);

    cleanup();
  });
});

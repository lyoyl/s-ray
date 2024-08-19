import { expect } from '@esm-bundle/chai';
import { restore } from 'sinon';
import { SBaseElement, computed, defineElement, html, reactive } from '../src/index.js';
import { fixture } from './test-utils.js';

beforeEach(() => {
  restore();
});

describe('Reactive rendering', () => {
  it('reactive decorator - dynamic text content', () => {
    @defineElement({
      template: html<MyComp>`
        <h1>${'counter'}----${'counter'}</h1>
      `,
    })
    class MyComp extends SBaseElement {
      @reactive
      counter = 1;
    }

    const cleanup = fixture('<my-comp></my-comp>');

    const myComp = document.querySelector<MyComp>('my-comp')!;
    expect(myComp.shadowRoot!.querySelector('h1')!.textContent).to.equal('1----1');
    myComp.counter = 2;
    expect(myComp.shadowRoot!.querySelector('h1')!.textContent).to.equal('2----2');

    cleanup();
  });

  it('reactive decorator - dynamic attribute', () => {
    @defineElement({
      template: html<MyComp2>`
        <h1 id="${'uniqueId'}" class="${'customCls'} foo bar"></h1>
      `,
    })
    class MyComp2 extends SBaseElement {
      @reactive
      uniqueId = 'my-id';
      @reactive
      customCls = 'custom-cls1 custom-cls2';
    }

    const cleanup = fixture('<my-comp2></my-comp2>');

    const myComp = document.querySelector<MyComp2>('my-comp2')!;
    const h1 = myComp.shadowRoot!.querySelector('h1')!;
    expect(h1.id).to.equal('my-id');
    expect(h1.className).to.equal('custom-cls1 custom-cls2 foo bar');

    myComp.uniqueId = 'my-new-id';
    myComp.customCls = 'new-cls1 new-cls2';
    expect(h1.id).to.equal('my-new-id');
    expect(h1.className).to.equal('new-cls1 new-cls2 foo bar');

    cleanup();
  });

  it('computed decorator - dynamic text content', () => {
    @defineElement({
      template: html<MyComp3>`
        <h1>${'counter'}</h1>
        <h1>${'double'}</h1>
      `,
    })
    class MyComp3 extends SBaseElement {
      @reactive
      counter = 1;

      @computed
      get double() {
        return this.counter * 2;
      }
    }

    const cleanup = fixture('<my-comp3></my-comp3>');

    const myComp = document.querySelector<MyComp3>('my-comp3')!;
    expect(myComp.shadowRoot!.querySelectorAll('h1')[0].textContent).to.equal('1');
    expect(myComp.shadowRoot!.querySelectorAll('h1')[1].textContent).to.equal('2');
    myComp.counter = 2;
    expect(myComp.shadowRoot!.querySelectorAll('h1')[0].textContent).to.equal('2');
    expect(myComp.shadowRoot!.querySelectorAll('h1')[1].textContent).to.equal('4');

    cleanup();
  });

  it('only the computed member is used in template', () => {
    @defineElement({
      template: html<MyComp4>`
        <h1>${'double'}</h1>
      `,
    })
    class MyComp4 extends SBaseElement {
      @reactive
      counter = 1;

      @computed
      get double() {
        return this.counter * 2;
      }
    }

    const cleanup = fixture('<my-comp4></my-comp4>');

    const myComp = document.querySelector<MyComp4>('my-comp4')!;
    expect(myComp.shadowRoot!.querySelector('h1')!.textContent).to.equal('2');
    myComp.counter = 2;
    expect(myComp.shadowRoot!.querySelector('h1')!.textContent).to.equal('4');

    cleanup();
  });

  it('a computed member can depend on another computed member', () => {
    @defineElement({
      template: html<MyComp5>`
        <h1>${'double'}</h1>
        <h1>${'triple'}</h1>
      `,
    })
    class MyComp5 extends SBaseElement {
      @reactive
      counter = 1;

      @computed
      get double() {
        return this.counter * 2;
      }

      @computed
      get triple() {
        return this.double * 1.5;
      }
    }

    const cleanup = fixture('<my-comp5></my-comp5>');

    const myComp = document.querySelector<MyComp5>('my-comp5')!;
    expect(myComp.counter).to.equal(1);
    expect(myComp.shadowRoot!.querySelectorAll('h1')[0].textContent).to.equal('2');
    expect(myComp.shadowRoot!.querySelectorAll('h1')[1].textContent).to.equal('3');
    myComp.counter = 2;
    expect(myComp.shadowRoot!.querySelectorAll('h1')[0].textContent).to.equal('4');
    expect(myComp.shadowRoot!.querySelectorAll('h1')[1].textContent).to.equal('6');

    cleanup();
  });
});

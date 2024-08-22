import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';
import { html } from './html.js';

describe('The html function', () => {
  it('should collect dynamic parts', () => {
    const staticVar = 1;
    const funcInterpolator = () => 1;
    const templateA = html`<div>This is static ${staticVar} ${funcInterpolator} </div>`;
    expect(templateA.dynamicPartToGetterMap.size).to.equal(1);
    expect(templateA.dynamicPartToGetterMap.has('$$--Dynamic0--$$')).to.be.true;
    expect(templateA.dynamicPartToGetterMap.get('$$--Dynamic0--$$')).to.equal(funcInterpolator);

    const template = html`<div>This is static ${staticVar} ${funcInterpolator} ${templateA}</div>`;
    expect(template.dynamicPartToGetterMap.size).to.equal(2);
    expect(template.dynamicPartToGetterMap.has('$$--Dynamic0--$$')).to.be.true;
    expect(template.dynamicPartToGetterMap.get('$$--Dynamic0--$$')).to.equal(funcInterpolator);
    expect(template.dynamicPartToGetterMap.has('$$--Dynamic1--$$')).to.be.true;
    expect(template.dynamicPartToGetterMap.get('$$--Dynamic1--$$')).to.equal(templateA);
  });

  it('templates with same static pattern should hit the cache, but the dynamic parts shoud be updated', () => {
    const funcInterpolatorA = () => 1;
    const funcInterpolatorB = () => 2;
    const templateA = html`<div>This is static 1 ${100}, ${funcInterpolatorA}</div>`;
    const templateB = html`<div>This is static 1 ${100}, ${funcInterpolatorB}</div>`;
    expect(templateA.originalDoc).to.equal(templateB.originalDoc);
    expect(templateA.doc).to.not.equal(templateB.doc);
    expect(templateA.dynamicPartToGetterMap.get('$$--Dynamic0--$$')).to.equal(funcInterpolatorA);
    expect(templateB.dynamicPartToGetterMap.get('$$--Dynamic0--$$')).to.equal(funcInterpolatorB);
  });

  it('cloned templates should share the same dynamicPartToGetterMap', () => {
    const funcInterpolatorA = () => 1;
    const templateA = html`<div>This is static 1 ${100}, ${funcInterpolatorA}</div>`;
    const templateB = templateA.clone();
    expect(templateA.dynamicPartToGetterMap).to.equal(templateB.dynamicPartToGetterMap);
    expect(templateA.originalDoc).to.equal(templateB.originalDoc);
    expect(templateA.doc).to.not.equal(templateB.doc);
  });

  it('static parts text rendering should work correctly', () => {
    // Primitive values: string, number, boolean
    const template = html`<div>I am a ${'UI Library'}, it is worth ${100} per second for ${true}</div>`;
    expect(template.doc.textContent).to.equal('I am a UI Library, it is worth 100 per second for true');
    // null and undefined are rendered as its string representation
    const template2 = html`<div>${null} ${undefined}</div>`;
    expect(template2.doc.textContent).to.equal('null undefined');
  });

  it('function interpolator - text rendering should work correctly', () => {
    const funcInterpolator = () => 1;
    const funcInterpolator2 = () => 'Hello';
    const template = html`<div>${funcInterpolator} -- ${funcInterpolator2}</div>`;
    expect(template.doc.textContent).to.equal('1 -- Hello');
  });

  it('attribute rendering', () => {
    const funcInterpolator = () => 'cls1 cls2';
    const template = html`<div class="${funcInterpolator} cls3"></div>`;
    expect(template.doc.querySelector('div')!.getAttribute('class')).to.equal('cls1 cls2 cls3');
  });

  it('ref interpolation', () => {
    let dom;
    const domRefSetter = (el: Element) => dom = el;
    const template = html`<div ref=${domRefSetter}></div>`;
    expect(template.doc.querySelector('div')).to.equal(dom);
  });

  it('a template is used by another template multiple times', () => {
    const funcInterpolator = () => 1;
    const templateA = html`<p>${funcInterpolator}</p>`;
    const templateB = html`<div>${templateA} -- ${templateA}</div>`;
    expect(templateB.doc.querySelectorAll('p').length).to.equal(2);
    expect(templateB.doc.querySelectorAll('p')[0].textContent).to.equal('1');
    expect(templateB.doc.querySelectorAll('p')[1].textContent).to.equal('1');
    expect(templateB.doc.querySelector('div')!.textContent).to.equal('1 -- 1');
  });

  it('a function interpolator that returns a template', () => {
    const funcInterpolator = () => html`<p>1</p>`;
    const template = html`<div>${funcInterpolator}</div>`;
    expect(template.doc.querySelector('div')!.outerHTML).to.equal('<div><p>1</p><!--anchor--></div>');

    // Can be used multiple times
    const template2 = html`<div>${funcInterpolator} -- ${funcInterpolator}</div>`;
    expect(template2.doc.querySelector('div')!.outerHTML).to.equal(
      '<div><p>1</p><!--anchor--> -- <p>1</p><!--anchor--></div>',
    );
  });

  it('render templates conditionally', () => {
    const tplA = html`<p>1</p>`;
    const tplB = html`<p>2</p>`;
    let condition = true;
    const template = html`<div>${() => condition ? tplA : tplB}</div>`;
    expect(template.doc.querySelector('div')!.textContent).to.equal('1');

    condition = false;
    template.triggerRender();
    expect(template.doc.querySelector('div')!.textContent).to.equal('2');

    condition = true;
    template.triggerRender();
    expect(template.doc.querySelector('div')!.textContent).to.equal('1');
  });

  it('conditional rendering with a template and a non-template value', () => {
    const tplA = html`<p>1</p>`;
    const staticValue = 'hello world';
    let condition = true;
    const template = html`<div>${() => condition ? tplA : staticValue}</div>`;
    expect(template.doc.querySelector('div')!.textContent).to.equal('1');

    condition = false;
    template.triggerRender();
    expect(template.doc.querySelector('div')!.textContent).to.equal(staticValue);

    condition = true;
    template.triggerRender();
    expect(template.doc.querySelector('div')!.textContent).to.equal('1');
  });

  it('template recycling', () => {
    const template = html`<div></div>`;
    const div1 = template.doc.querySelector('div');

    document.body.append(template.doc);
    expect(document.body.querySelector('div')).to.equal(div1);
    expect(template.doc.querySelector('div')).to.be.null;

    template.recycle();
    expect(document.body.querySelector('div')).to.be.null;
    expect(template.doc.querySelector('div')).to.equal(div1);
  });

  it('event binding', () => {
    const handler = fake();
    const template = html`<button @click=${handler}></button>`;
    document.body.append(template.doc);

    document.body.querySelector('button')!.click();
    expect(handler.calledOnce).to.be.true;
    expect(handler.firstCall.args[0]).to.be.instanceOf(MouseEvent);
  });
});
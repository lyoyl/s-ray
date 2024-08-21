import { expect } from '@esm-bundle/chai';
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

  it('a template is used by another template', () => {
    const funcInterpolator = () => 1;
    const templateA = html`<p>${funcInterpolator}</p>`;
    const templateB = html`<div>${templateA} -- ${templateA}</div>`;
    expect(templateB.doc.querySelectorAll('p').length).to.equal(2);
    expect(templateB.doc.querySelectorAll('p')[0].textContent).to.equal('1');
    expect(templateB.doc.querySelectorAll('p')[1].textContent).to.equal('1');
    expect(templateB.doc.querySelector('div')!.textContent).to.equal('1 -- 1');
  });
});
import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';
import { removeAnchors } from '../test/test-utils.js';
import { domRef } from './domRef.js';
import { html, unsafeHtml } from './html.js';
import { nextTick } from './scheduler.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('The html function', () => {
  it('html`` should be lazy parsed', () => {
    const template = html`<div>${() => 1}</div>`;
    expect(template.isInitialized).to.be.false;
    // the template will be parsed and initialized when it is mounted to the DOM
    template.mountTo(document.body);
    expect(template.isInitialized).to.be.true;
  });

  it('should work as expected with parent-child relationship', () => {
    const child1 = html`<a></a>`;
    const child2 = html`<h1>${child1}</h1>`;
    const root = html`<div>${child2}</div>`;

    // before mounting
    expect(root.isInUse).to.be.false;
    expect(child1.isInUse).to.be.false;
    expect(child2.isInUse).to.be.false;
    expect(root.children.size).to.equal(0);
    expect(root.parent).to.be.null;
    expect(child2.children.size).to.equal(0);
    expect(child2.parent).to.be.null;
    expect(child1.children.size).to.equal(0);
    expect(child1.parent).to.be.null;

    root.mountTo(document.body);

    // after mounting
    expect(root.isInUse).to.be.true;
    expect(child1.isInUse).to.be.true;
    expect(child2.isInUse).to.be.true;
    expect(root.children.size).to.equal(1);
    expect(root.children.has(child2)).to.be.true;
    expect(root.parent).to.be.null; // Since it is a root template
    expect(child2.children.size).to.equal(1);
    expect(child2.children.has(child1)).to.be.true;
    expect(child2.parent).to.equal(root);
    expect(child1.children.size).to.equal(0);
    expect(child1.parent).to.equal(child2);
    expect(removeAnchors(document.body.innerHTML)).to.equal('<div><h1><a></a></h1></div>');

    // unmount child2, which should also unmount child1
    child2.unmount();
    expect(root.children.size).to.equal(0);
    expect(child2.isInUse).to.be.false;
    expect(child2.parent).to.be.null;
    expect(child2.children.size).to.equal(0);
    expect(child1.isInUse).to.be.false;
    expect(child1.parent).to.be.null;
    expect(child1.children.size).to.equal(0);
    expect(removeAnchors(document.body.innerHTML)).to.equal('<div></div>'); // TODO: why this anchor is not removed? Should it be removed? May not.
  });

  it('should collect dynamic parts', () => {
    const staticVar = 1;
    const funcInterpolator = () => 1;
    const templateA = html`<div>This is static ${staticVar} ${funcInterpolator} </div>`;
    expect(templateA.dynamicPartToGetterMap.size).to.equal(1);
    expect(templateA.dynamicPartToGetterMap.has('$$--dynamic0--$$')).to.be.true;
    expect(templateA.dynamicPartToGetterMap.get('$$--dynamic0--$$')).to.equal(funcInterpolator);

    const template = html`<div>This is static ${staticVar} ${funcInterpolator} ${templateA}</div>`;
    expect(template.dynamicPartToGetterMap.size).to.equal(2);
    expect(template.dynamicPartToGetterMap.has('$$--dynamic0--$$')).to.be.true;
    expect(template.dynamicPartToGetterMap.get('$$--dynamic0--$$')).to.equal(funcInterpolator);
    expect(template.dynamicPartToGetterMap.has('$$--dynamic1--$$')).to.be.true;
    expect(template.dynamicPartToGetterMap.get('$$--dynamic1--$$')).to.equal(templateA);
  });

  it('two templates with the same static pattern should be considered as the same', async () => {
    const templateA = html`<h1>${() => 1}</h1>`;
    const templateB = html`<h1>${() => 2}</h1>`;

    templateA.adoptGettersFrom(templateB);
    templateA.mountTo(document.body);
    expect(removeAnchors(document.body.querySelector('h1')?.outerHTML!)).to.equal('<h1>2</h1>');

    const templateC = html`<h1>${html`<span>123</span>`}</h1>`;
    templateA.adoptGettersFrom(templateC);
    templateA.update();
    await nextTick();
    expect(removeAnchors(document.body.querySelector('h1')?.outerHTML!)).to.equal('<h1><span>123</span></h1>');
  });

  it('templates with same static pattern should hit the cache, but the dynamic parts shoud be updated', () => {
    const funcInterpolatorA = () => 1;
    const funcInterpolatorB = () => 2;
    const templateA = html`<div>This is static 1 ${100}, ${funcInterpolatorA}</div>`;
    const templateB = html`<div>This is static 1 ${100}, ${funcInterpolatorB}</div>`;
    expect(templateA.originalDoc).to.equal(templateB.originalDoc);
    expect(templateA.dynamicPartToGetterMap.get('$$--dynamic0--$$')).to.equal(funcInterpolatorA);
    expect(templateB.dynamicPartToGetterMap.get('$$--dynamic0--$$')).to.equal(funcInterpolatorB);
  });

  it('cloned templates should share the same dynamicPartToGetterMap', () => {
    const funcInterpolatorA = () => 1;
    const templateA = html`<div>This is static 1 ${100}, ${funcInterpolatorA}</div>`;
    const templateB = templateA.clone();
    expect(templateA.dynamicPartToGetterMap).to.equal(templateB.dynamicPartToGetterMap);
    expect(templateA.originalDoc).to.equal(templateB.originalDoc);
  });

  it('static parts text rendering should work correctly', () => {
    // Primitive values: string, number, boolean
    const template = html`<div>I am a ${'UI Library'}, it is worth ${100} per second for ${true}</div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.textContent).to.equal('I am a UI Library, it is worth 100 per second for true');
    // null and undefined are rendered as its string representation
    const template2 = html`<div>${null} ${undefined}</div>`;
    const container2 = document.createElement('div');
    template2.mountTo(container2);
    expect(container2.textContent).to.equal('null undefined');
  });

  it('function interpolator - text rendering should work correctly', () => {
    const funcInterpolator = () => 1;
    const funcInterpolator2 = () => 'Hello';
    const template = html`<div>${funcInterpolator} -- ${funcInterpolator2}</div>`;
    template.mountTo(document.body);
    expect(document.body.textContent).to.equal('1 -- Hello');
  });

  it('attribute rendering', async () => {
    const funcInterpolator = () => 'cls1 cls2';
    let toggle = true;
    const template = html`<div class="${funcInterpolator} cls3 ${() => toggle ? 'cls4' : 'cls5'}"></div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelector('div')!.getAttribute('class')).to.equal('cls1 cls2 cls3 cls4');
    toggle = false;
    template.update();
    await nextTick();
    expect(container.querySelector('div')!.getAttribute('class')).to.equal('cls1 cls2 cls3 cls5');
  });

  it('ref interpolation', () => {
    const domRefSetter = fake();
    const template = html`<div ref=${domRefSetter}></div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(domRefSetter.calledOnce).to.be.true;
    expect(domRefSetter.firstCall.args[0]).to.be.instanceOf(HTMLDivElement);
    domRefSetter.resetHistory();
    template.unmount();
    expect(domRefSetter.calledOnce).to.be.true;
    expect(domRefSetter.firstCall.args[0]).to.be.null;
  });

  it('domRef interpolation', () => {
    const el = domRef<HTMLHeadingElement>();
    const template = html`<h1 ${el}>List</h1>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelector('h1') === el.value).to.be.true;
    template.unmount();
    expect(el.value).to.be.null;
  });

  it('a template is used by another template multiple times', () => {
    const funcInterpolator = () => 1;
    const templateA = html`<p>${funcInterpolator}</p>`;
    const templateB = html`<div>${templateA} -- ${templateA}</div>`;

    const container = document.createElement('div');
    templateB.mountTo(container);
    expect(container.querySelectorAll('p').length).to.equal(2);
    expect(container.querySelectorAll('p')[0].textContent).to.equal('1');
    expect(container.querySelectorAll('p')[1].textContent).to.equal('1');
    expect(container.querySelector('div')!.textContent).to.equal('1 -- 1');
  });

  it('a function interpolator that returns a template', () => {
    const funcInterpolator = () => html`<p>1</p>`;
    const template = html`<div>${funcInterpolator}</div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(removeAnchors(container.querySelector('div')!.outerHTML)).to.equal('<div><p>1</p></div>');

    // Can be used multiple times
    const template2 = html`<div>${funcInterpolator} -- ${funcInterpolator}</div>`;
    const container2 = document.createElement('div');
    template2.mountTo(container2);
    expect(removeAnchors(container2.querySelector('div')!.outerHTML)).to.equal(
      '<div><p>1</p> -- <p>1</p></div>',
    );
  });

  it('render templates conditionally', async () => {
    const tplA = html`<p>1</p>`;
    const tplB = html`<p>2</p>`;
    let condition = true;
    const template = html`<div>${() => condition ? tplA : tplB}</div>`;
    const container1 = document.createElement('div');
    template.mountTo(container1);
    expect(container1.querySelector('div')!.textContent).to.equal('1');

    condition = false;
    template.update();
    await nextTick();
    expect(container1.querySelector('div')!.textContent).to.equal('2');

    condition = true;
    template.update();
    await nextTick();
    expect(container1.querySelector('div')!.textContent).to.equal('1');
  });

  it('conditional rendering with a template and a non-template value', async () => {
    const tplA = html`<p>1</p>`;
    const staticValue = 'hello world';
    let condition = true;
    const template = html`<div>${() => condition ? tplA : staticValue}</div>`;
    const container1 = document.createElement('div');
    template.mountTo(container1);
    expect(container1.querySelector('div')!.textContent).to.equal('1');

    condition = false;
    template.update();
    await nextTick();
    expect(container1.querySelector('div')!.textContent).to.equal(staticValue);

    condition = true;
    template.update();
    await nextTick();
    expect(container1.querySelector('div')!.textContent).to.equal('1');
  });

  it('template unmount', () => {
    const template = html`<div></div>`;
    expect(template.isInUse).to.be.false;

    const container1 = document.createElement('div');
    template.mountTo(container1);
    const div1 = container1.querySelector('div');

    expect(template.isInUse).to.be.true;
    expect(container1.querySelector('div')).to.equal(div1);

    template.unmount();
    expect(template.isInUse).to.be.false;
    expect(container1.querySelector('div')).to.be.null;
  });

  it('event binding', () => {
    const handler = fake();
    const template = html`<button @click=${handler}></button>`;
    template.mountTo(document.body);

    document.body.querySelector('button')!.click();
    expect(handler.calledOnce).to.be.true;
    expect(handler.firstCall.args[0]).to.be.instanceOf(MouseEvent);
  });

  it('List rendering', async () => {
    let data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    const renderList = () => {
      return data.map(item => html`<li>${() => item.name}</li>`);
    };
    const template = html`
      <ul>
        ${renderList}
      </ul>
    `;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Charlie');

    // Update data
    data = [
      { id: 3, name: 'Charlie' },
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 4, name: 'David' },
    ];
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(4);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Charlie');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[3].textContent).to.equal('David');
  });

  it('List rendering with conditional rendering', async () => {
    let data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    const renderList = () => {
      return data.map(item => html`<li>${() => item.name}</li>`);
    };

    let isLoading = true;
    const template = html`
      <ul>
        ${() => isLoading ? html`<li>Loading...</li>` : renderList()}
      </ul>
    `;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelectorAll('li').length).to.equal(1);
    expect(container.querySelector('li')!.textContent).to.equal('Loading...');

    isLoading = false;
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Charlie');

    isLoading = true;
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(1);
    expect(container.querySelector('li')!.textContent).to.equal('Loading...');
  });

  it('List rendering with different length of children', async () => {
    let data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    const renderList = () => {
      return data.map(item => html`<li>${() => item.name}</li>`);
    };

    const template = html`
      <ul>
        ${renderList}
      </ul>
    `;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Charlie');

    // Update data
    data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(2);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');

    // Update data
    data = [
      { id: 3, name: 'Charlie' },
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Charlie');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Bob');
  });

  it('List rendering with different list items', async () => {
    let dataA = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    const renderListA = () => {
      return dataA.map(item => html`<li>${() => item.name}</li>`);
    };

    let dataB = [
      { id: 1, price: 100 },
      { id: 2, price: 200 },
    ];
    const renderListB = () => {
      return dataB.map(item => html`<li>Price: ${() => item.price}</li>`);
    };

    let toggle = true;
    const template = html`
      <ul>
        ${() => toggle ? renderListA() : renderListB()}
      </ul>
    `;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Charlie');

    toggle = false;
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(2);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Price: 100');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Price: 200');
  });

  it('keyed list rendering', async () => {
    let data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    const renderList = () => {
      return data.map(item =>
        html(item.id)`
        <li>${() => item.name}</li>
        <input id=${() => `input-${item.id}`} />
      `
      );
    };
    const template = html`
      <ul>
        ${renderList}
      </ul>
    `;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelectorAll('li').length).to.equal(3);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Bob');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('Charlie');

    // Get the input element that it is ID is 2
    const input = container.querySelector<HTMLInputElement>('#input-2')!;
    input.value = 'Hello';

    // Update data
    data = [
      { id: 3, name: 'Charlie' },
      { id: 1, name: 'Alice' },
      { id: 4, name: 'David' },
      { id: 5, name: 'David2' },
    ];
    template.update();
    await nextTick();
    expect(container.querySelectorAll('li').length).to.equal(4);
    expect(container.querySelectorAll('li')[0].textContent).to.equal('Charlie');
    expect(container.querySelectorAll('li')[1].textContent).to.equal('Alice');
    expect(container.querySelectorAll('li')[2].textContent).to.equal('David');
    expect(container.querySelectorAll('li')[3].textContent).to.equal('David2');

    // The text of the input element with ID 2 should be kept
    expect(input.value).to.equal('Hello');
  });

  it('custom directive', () => {
    const myDir = fake();
    const template = html`<div ${myDir}>text</div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(myDir.calledOnce).to.be.true;
    expect(myDir.firstCall.args[0]).to.be.instanceOf(HTMLDivElement);
    myDir.resetHistory();
    template.unmount();
    expect(myDir.calledOnce).to.be.true;
    expect(myDir.firstCall.args[0]).to.be.null;
  });

  it('should sanitize static parts', () => {
    const template = html`<div>${'<script>alert(1)</script>'}</div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect(container.querySelector('div')!.textContent).to.equal('<script>alert(1)</script>');
  });

  it('should not sanitize unsafe HTML', () => {
    const unsafe = unsafeHtml`<div>${'<h1>title</h1>'}</div>`;
    const container = document.createElement('div');
    unsafe.mountTo(container);
    expect(container.querySelector('h1')!.textContent).to.equal('title');
  });

  it('use the colon to declare a property binding', async () => {
    let counter = 1;
    const template = html`<div :abc=${() => counter}></div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect((container.querySelector('div') as HTMLDivElement & { abc: number })!.abc).to.equal(1);
    counter = 2;
    template.update();
    await nextTick();
    expect((container.querySelector('div') as HTMLDivElement & { abc: number })!.abc).to.equal(2);
  });

  it('use the question mark to declare a boolean property bingding', async () => {
    let counter: any = 1;
    const template = html`<div ?abc=${() => counter}></div>`;
    const container = document.createElement('div');
    template.mountTo(container);
    expect((container.querySelector('div') as HTMLDivElement & { abc: boolean })!.abc).to.equal(true);
    counter = '';
    template.update();
    await nextTick();
    expect((container.querySelector('div') as HTMLDivElement & { abc: number })!.abc).to.equal(true);
    counter = 0;
    template.update();
    await nextTick();
    expect((container.querySelector('div') as HTMLDivElement & { abc: number })!.abc).to.equal(true);
    counter = false;
    template.update();
    await nextTick();
    expect((container.querySelector('div') as HTMLDivElement & { abc: number })!.abc).to.equal(false);
  });
});

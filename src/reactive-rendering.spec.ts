import { expect } from '@esm-bundle/chai';
import { html } from './html.js';
import { ref } from './reactive.js';

describe('Reactive rendering', () => {
  it('render a template with a primitive reactive value', () => {
    const counter = ref(0);
    const template = html`<div>${() => counter.value}</div>`;
    expect(template.doc.querySelector('div')!.textContent).to.equal('0');
    counter.value = 100;
    expect(template.doc.querySelector('div')!.textContent).to.equal('100');
  });

  it('attrbute reactive rendering', () => {
    const counter = ref(0);
    const template = html`<div data-value="${() => counter.value}"></div>`;
    expect(template.doc.querySelector('div')!.getAttribute('data-value')).to.equal('0');
    counter.value = 100;
    expect(template.doc.querySelector('div')!.getAttribute('data-value')).to.equal('100');
  });

  it('conditional rendering - between 2 templates', () => {
    const toggle = ref(true);
    const templateA = html`<p>Template A</p>`;
    const templateB = html`<p>Template B</p>`;
    const template = html`<div>${() => toggle.value ? templateA : templateB}</div>`;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Template A');
    toggle.value = false;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Template B');
    toggle.value = true;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Template A');
  });

  it('conditional rendering - between template and primitive value', () => {
    const toggle = ref(true);
    const templateA = html`<p>Template A</p>`;
    const template = html`<div>${() => toggle.value ? templateA : 'Primitive'}</div>`;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Template A');
    toggle.value = false;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Primitive');
    toggle.value = true;
    expect(template.doc.querySelector('div')!.textContent).to.equal('Template A');
  });

  it('a reactive value used by multiple templates', () => {
    const counter = ref(0);
    const templateA = html`<div>${() => counter.value} - ${() => counter.value}</div>`;
    const templateB = html`<div>${() => counter.value} - ${() => counter.value}</div>`;
    expect(templateA.doc.querySelector('div')!.textContent).to.equal('0 - 0');
    expect(templateB.doc.querySelector('div')!.textContent).to.equal('0 - 0');
    counter.value = 100;
    expect(templateA.doc.querySelector('div')!.textContent).to.equal('100 - 100');
    expect(templateB.doc.querySelector('div')!.textContent).to.equal('100 - 100');
  });

  it('list rendering', () => {
    const items = ref(['a', 'b']);
    const template = html`
      <ul>
        ${() => items.value.map(item => html`<li>${() => item}</li>`)}
      </ul>
    `;
    expect(template.doc.querySelectorAll('li')).to.have.length(2);
    expect(template.doc.querySelectorAll('li')[0].textContent).to.equal('a');
    expect(template.doc.querySelectorAll('li')[1].textContent).to.equal('b');
    items.value = ['c', 'b', 'd'];
    expect(template.doc.querySelectorAll('li')).to.have.length(3);
    expect(template.doc.querySelectorAll('li')[0].textContent).to.equal('c');
    expect(template.doc.querySelectorAll('li')[1].textContent).to.equal('b');
    expect(template.doc.querySelectorAll('li')[2].textContent).to.equal('d');
  });

  it('list rendering with conditional rendering', () => {
    const items = ref(['aa', 'b', 'cc', 'd']);
    const template = html`
      <ul>
        ${() =>
      items.value.map((item) => {
        return html`<li>${() => item.length % 2 === 0 ? 'Even' : 'Odd'}</li>`;
      })}
      </ul>
    `;
    expect(template.doc.querySelectorAll('li')).to.have.length(4);
    expect(template.doc.querySelectorAll('li')[0].textContent).to.equal('Even');
    expect(template.doc.querySelectorAll('li')[1].textContent).to.equal('Odd');
    expect(template.doc.querySelectorAll('li')[2].textContent).to.equal('Even');
    expect(template.doc.querySelectorAll('li')[3].textContent).to.equal('Odd');

    items.value = ['aaa', 'b', 'cc', 'd', 'ee'];
    expect(template.doc.querySelectorAll('li')).to.have.length(5);
    expect(template.doc.querySelectorAll('li')[0].textContent).to.equal('Odd');
    expect(template.doc.querySelectorAll('li')[1].textContent).to.equal('Odd');
    expect(template.doc.querySelectorAll('li')[2].textContent).to.equal('Even');
    expect(template.doc.querySelectorAll('li')[3].textContent).to.equal('Odd');
    expect(template.doc.querySelectorAll('li')[4].textContent).to.equal('Even');
  });

  it('recursive rendering', () => {
    // TODO
    const tree = ref({
      value: 0,
      children: [
        {
          value: 1,
          children: [
            {
              value: 3,
              children: [],
            },
          ],
        },
        {
          value: 2,
          children: [],
        },
      ],
    });

    const treeItemTemplate = html`
      <div></div>
    `;
  });
});

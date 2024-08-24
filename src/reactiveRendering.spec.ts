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
    const treeData = ref({
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

    function renderTree(tree: typeof treeData.value) {
      return html`
        <div>
          <span>${() => tree.value}</span>
          ${() => tree.children.map(child => renderTree(child))}
        </div>
      `;
    }

    const template = html`${() => renderTree(treeData.value)}`;
    /**
     * The tree DOM structure should look like this:
     * <div>
     *   <span>0</span>
     *   <div>
     *     <span>1</span>
     *     <div>
     *       <span>3</span>
     *     </div>
     *   </div>
     *   <div>
     *     <span>2</span>
     *   </div>
     * </div>
     */
    expect(template.doc.children.length).to.equal(1);
    const div1 = template.doc.children[0];
    expect(div1.children.length).to.equal(3);
    const span0 = div1.children[0];
    expect(span0.textContent).to.equal('0');
    const div2 = div1.children[1];
    expect(div2.children.length).to.equal(2);
    const span1 = div2.children[0];
    expect(span1.textContent).to.equal('1');
    const div3 = div2.children[1];
    expect(div3.children.length).to.equal(1);
    const span2 = div3.children[0];
    expect(span2.textContent).to.equal('3');
    const div4 = div1.children[2];
    expect(div4.children.length).to.equal(1);
    const span3 = div4.children[0];
    expect(span3.textContent).to.equal('2');
  });

  it('should work with parent-child relationship', () => {
    const toggle = ref(true);
    const templateA = html`<span>Template A</span>`;
    const templateB = html`<p>${templateA}</p>`;
    const template = html`<div>${() => toggle.value ? templateB : ''}</div>`;

    // before mounting
    expect(templateA.isInUse).to.be.false;
    expect(templateB.isInUse).to.be.false;
    expect(templateB.children.size).to.equal(0);
    expect(template.isInUse).to.be.false;
    expect(template.children.size).to.equal(0);

    template.mountTo(document.createElement('div'));
    // after mounting
    expect(templateA.isInUse).to.be.true;
    expect(templateB.isInUse).to.be.true;
    expect(templateB.children.size).to.equal(1);
    expect(templateB.children.has(templateA)).to.be.true;
    expect(template.isInUse).to.be.true;
    expect(template.children.size).to.equal(1);
    expect(template.children.has(templateB)).to.be.true;

    toggle.value = false;
    // TemplateB and TemplateA should be unmounted
    expect(templateA.isInUse).to.be.false;
    expect(templateB.isInUse).to.be.false;
    expect(templateB.children.size).to.equal(0);
    expect(template.isInUse).to.be.true;
    expect(template.children.size).to.equal(0);

    toggle.value = true;
    // TemplateB and TemplateA should be mounted again
    expect(templateA.isInUse).to.be.true;
    expect(templateB.isInUse).to.be.true;
    expect(templateB.children.size).to.equal(1);
    expect(templateB.children.has(templateA)).to.be.true;
    expect(template.isInUse).to.be.true;
    expect(template.children.size).to.equal(1);
    expect(template.children.has(templateB)).to.be.true;
  });
});

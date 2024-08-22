import { domRef, html } from '../src/index.js';

const h1 = domRef<HTMLHeadingElement>();

const data = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

const renderList = () => {
  return data.map(item => html`<li>${item.name}</li>`);
};

const template = html`
  <h1 ${h1}>List</h1>
  <ul>
    ${renderList}
  </ul>
`;

console.log(h1.value);

console.log('---', template.doc.childNodes.length);

document.body.appendChild(template.doc);

console.log('---', template.doc.childNodes.length);

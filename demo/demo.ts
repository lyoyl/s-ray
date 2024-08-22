import { domRef, html } from '../src/index.js';

const h1 = domRef<HTMLHeadingElement>();

const template = html`
  <h1 ${h1}>List</h1>
`;

console.log(h1.value);

document.body.appendChild(template.doc);

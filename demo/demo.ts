import { html } from '../src/html.js';

let a = 0;
const funcInterpolator = () => a++;
const li = html`<li>${funcInterpolator}</li>`;
const ul = html`
  <ul>
    ${li}
    ${li}
  </div>
`;

const template = html`
  <h1>List</h1>
  ${ul}
`;

document.body.appendChild(template.doc);

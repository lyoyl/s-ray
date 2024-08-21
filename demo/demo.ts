import { html } from "../src/html.js";

const val = 1;

const template = html`
  <div>hello wooldsdfs</div>
  <h1>${val}</h1>
`

document.body.appendChild(template.doc);
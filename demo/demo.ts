import { html, ref } from '../src/index.js';

const counter = ref(0);

counter.value = 100;

function handleClick(e: MouseEvent) {
  counter.value += 1;
  e.stopPropagation();
}

const templateA = html`
  <button @click=${handleClick}>Cournter: <span>${() => counter.value}~</span>! ${() => counter.value}~</span>! ${() =>
  counter.value}~</span>!</button>
`;

const toggle = ref(true);

function handleToggle() {
  toggle.value = !toggle.value;
}

const template = html`
  <div style="border: 10px solid red;" @click="${handleToggle}">
    ${() => toggle.value ? templateA : html`<div>Toggle is off</div>`}
  </div>
`;

document.body.appendChild(template.doc);

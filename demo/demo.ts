import { html, ref, watch } from '../src/index.js';

const count = ref(0);

watch(() => count.value * 2, val => {
  console.log('count * 2:', val);
});

watch(count, val => {
  console.log('count:', val);
});

const template = html`
  <button @click=${() => count.value++}>Increment</button>
  <p>Count: ${() => count.value}</p>
`;

template.mountTo(document.body);

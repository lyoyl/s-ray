import { html, ref, watch } from '../src/index.js';

const count = ref(0);

watch(() => count.value * 2, (oldValue, newValue) => {
  console.log('count * 2, oldValue', oldValue);
  console.log('count * 2, newValue', newValue);
});

const unwatch = watch(count, (oldValue, newValue) => {
  console.log('count:', oldValue);
  console.log('count:', newValue);
});

const template = html`
  <button @click=${() => count.value++}>Increment</button>
  <p>Count: ${() => count.value}</p>
  <button @click=${unwatch}>Unwatch</button>
`;

template.mountTo(document.body);

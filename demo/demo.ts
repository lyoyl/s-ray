import { html, ref, watch } from '../src/index.js';

const count = ref(0);

watch(() => count.value * 2, async (newValue, oldValue, onInvalidate) => {
  let expired = false;
  onInvalidate(() => {
    expired = true;
  });
  // simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (expired) {
    return;
  }

  console.log(`Count doubled: ${newValue}`);
});

const template = html`
  <button @click=${() => count.value++}>Increment</button>
  <p>Count: ${() => count.value}</p>
`;

template.mountTo(document.body);

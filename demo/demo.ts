import { defineElement, html, ref, watch } from '../src/index.js';

defineElement({
  name: 'my-app',
  setup() {
    const counter = ref(0);

    watch(counter, (newValue, oldValue) => {
      console.log('counter changed from', oldValue, 'to', newValue);
    });

    return {
      template: html`
        <div>
          <button @click=${() => counter.value++}>Increment</button>
          <span>${() => counter.value}</span>
        </div>
      `,
    };
  },
});

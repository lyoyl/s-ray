import { defineBooleanAttr, defineNumberAttr } from '../src/defineAttributes.js';
import { defineElement, html, ref, watch } from '../src/index.js';

const disabled = defineBooleanAttr('disabled', false);
const myAttr = defineNumberAttr('my-attr', 0);

const MyApp = defineElement({
  name: 'my-app',
  attrs: [disabled, myAttr] as const,
  setup(hostElement) {
    const counter = ref(0);

    watch(counter, (newValue, oldValue) => {
      console.log('counter changed from', oldValue, 'to', newValue);
    });

    // hostElement.disabled = true;
    // hostElement.myAttr = 12;

    return {
      template: html`
        <div>
          <button @click=${() => counter.value++}>Increment</button>
          <span>${() => counter.value}</span>
          <input type='checkbox' checked name=cheese disabled="false"> 
        </div>
      `,
    };
  },
});

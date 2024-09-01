import {
  defineBooleanAttr,
  defineElement,
  defineNumberAttr,
  defineProperty,
  html,
  onConnected,
  onDisconnected,
  ref,
  watch,
} from '../src/index.js';

const disabled = defineBooleanAttr('disabled', false);
const myAttr = defineNumberAttr('my-attr', 0);

const myProp = defineProperty('myProp', 10);

const MyApp = defineElement({
  name: 'my-app',
  attrs: [disabled, myAttr] as const,
  props: [myProp] as const,
  setup(hostElement) {
    const counter = ref(0);

    watch(counter, (newValue, oldValue) => {
      console.log('counter changed from', oldValue, 'to', newValue);
    });

    // hostElement.disabled = true;
    // hostElement.myAttr = 12;
    hostElement.myProp;
    console.log('hostElement.myProp', hostElement.myProp);

    onConnected(() => {
      console.log('connected');
    });

    onDisconnected(() => {
      console.log('disconnected');
    });

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

import { debug } from 'console';
import {
  computed,
  css,
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

const style1 = css`
  button {
    color: red;
  }
`;

const style2 = css`
  h3 {
    color: blue;
  }
`;

const MyApp = defineElement({
  name: 'my-app',
  attrs: [disabled, myAttr] as const,
  props: [myProp] as const,
  styles: [style1, style2],
  setup(hostElement) {
    const counter = ref(0);
    const double = computed(() => counter.value * 2);

    watch(() => double.value, () => {
      console.log('double changed');
    });

    // counter.value = 1;

    watch(counter, (newValue, oldValue) => {
      console.log('counter changed from', oldValue, 'to', newValue);
    });

    watch(double, (newValue, oldValue) => {
      console.log('double changed from', oldValue, 'to', newValue);
    });

    console.log(hostElement.internals);

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
          <span :abc=${() => counter.value}>${() => counter.value}</span>
          <h3>double: ${() => double.value}</h3>
        </div>
      `,
    };
  },
});

import {
  computed,
  css,
  defineBooleanAttr,
  defineElement,
  defineNumberAttr,
  defineProperty,
  domRef,
  html,
  onConnected,
  onDisconnected,
  ref,
  watch,
} from '../src/index.js';

const MyButton = defineElement({
  name: 'my-button',
  setup() {
    return {
      template: html`
        <button ?disabled=${() => true}>
          <slot></slot>
        </button>
      `,
    };
  },
});

const MyComponent = defineElement({
  name: 'my-component',
  setup() {
    const state = ref(0);
    const double = computed(() => state.value * 2);

    onConnected(() => {
      console.log('connected');
    });

    onDisconnected(() => {
      console.log('disconnected');
    });

    return {
      template: html`
        <p>State: ${() => state.value}</p>
        <p>Double: ${() => double.value}</p>
        <button @click=${() => {
        console.log('click');
        state.value++;
      }}>Increment</button>

        <my-button>Click me</my-button>
      `,
    };
  },
});

const MyApp = defineElement({
  name: 'my-app',
  setup() {
    const data = ref([
      { id: 1, name: 'Apple' },
      { id: 2, name: 'Banana' },
      { id: 3, name: 'Cherry' },
    ]);

    function renderList() {
      return data.value.map(item =>
        html(item.id)`
          <li data-id=${() => item.id} :prop=${() => item.name}>Name: ${() => item.name}; ID: ${() => item.id}</li>
          <input />
        `
      );
    }

    function handleClick() {
      data.value = [
        { id: 2, name: 'Banana' },
        { id: 4, name: 'Durian' },
        { id: 1, name: 'Apple' },
      ];
    }

    const buttonEl = domRef();

    const footer = html`<footer @click=${() => {
      console.log('footer is clicked');
    }}>footer</footer>`;

    return {
      template: html`
        <button ${buttonEl} @click=${handleClick}>Update</button>
        <ul>
          ${renderList}
          <my-component></my-component>
          ${footer}
        </ul>
      `,
    };
  },
});

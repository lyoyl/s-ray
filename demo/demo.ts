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

const MyButton = defineElement({
  name: 'my-button',
  setup() {
    const val1 = ref(1);
    const val2 = ref(2);

    function handleClick() {
      val1.value++;
      val2.value--;
    }

    return {
      template: html`
        <button @click=${handleClick}  data-foo="prev ${() => val1.value} middle ${() => val2.value} post">
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
        <button @click=${() => state.value++}>Increment</button>

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

    return {
      template: html`
        <button @click=${handleClick}>Update</button>
        <ul>
          ${renderList}
          <my-component></my-component>
        </ul>
      `,
    };
  },
});

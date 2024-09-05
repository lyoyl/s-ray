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

defineElement({
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
        <li>${() => item.name}</li>
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
        </ul>
      `,
    };
  },
});

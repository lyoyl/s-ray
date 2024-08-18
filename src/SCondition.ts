export class SCondition extends HTMLElement {
  static get observedAttributes() {
    return ['current'];
  }

  get current() {
    return this.getAttribute('current') || '';
  }

  set current(value) {
    this.setAttribute('current', value);
  }

  #slotElement!: HTMLSlotElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#slotElement = document.createElement('slot');
    this.shadowRoot!.appendChild(this.#slotElement);
    this.#render();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'current' && oldValue !== newValue) {
      this.#render();
    }
  }

  #render() {
    this.#slotElement!.setAttribute('name', this.current);
  }
}

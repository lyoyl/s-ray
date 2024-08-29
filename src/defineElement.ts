import { Template } from './html.js';

/**
 * @public
 */
export interface SetupResult {
  template: Template;
}

/**
 * @public
 */
export interface ComponentOptions {
  name: string;
  setup: () => SetupResult;
}

export let currentInstance: SRayElement;
const instanceStack: SRayElement[] = [];

export function setCurrentInstance(instance: SRayElement) {
  currentInstance = instance;
  instanceStack.push(instance!);
}

export function recoverCurrentInstance() {
  instanceStack.pop();
  currentInstance = instanceStack.at(-1)!;
}

/**
 * @public
 */
class SRayElement extends HTMLElement {
  #cleanups: Set<CallableFunction> = new Set();
  #setupResult: SetupResult | null = null;

  constructor(public options: ComponentOptions) {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    setCurrentInstance(this);
    this.#setupResult = this.options.setup();
    this.#setupResult.template.mountTo(this.shadowRoot!);
    recoverCurrentInstance();
  }

  disconnectedCallback() {
    this.#cleanups.forEach(cleanup => cleanup());
  }

  /**
   * @private
   */
  registerCleanup(cleanup: CallableFunction) {
    this.#cleanups.add(cleanup);
    this.#setupResult?.template.unmount();
  }
}

/**
 * @public
 */
export function defineElement(options: ComponentOptions) {
  customElements.define(
    options.name,
    class extends SRayElement {
      constructor() {
        super(options);
      }
    },
  );
}

import { Template } from './html.js';

/**
 * @public
 */
export interface ConnectedResult {
  template: Template;
}

/**
 * @public
 */
export interface ComponentOptions {
  name: string;
  connected: () => ConnectedResult;
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
  #connectedResult: ConnectedResult | null = null;

  constructor(public options: ComponentOptions) {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    setCurrentInstance(this);
    this.#connectedResult = this.options.connected();
    this.#connectedResult.template.mountTo(this.shadowRoot!);
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
    this.#connectedResult?.template.unmount();
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

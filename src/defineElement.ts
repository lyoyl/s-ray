import { Template } from "./html.js";

interface SetupResult {
  template: Template;
}

interface ComponentOptions {
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

class SRayElement extends HTMLElement {
  constructor(public options: ComponentOptions) {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    setCurrentInstance(this);
    const setupResult = this.options.setup();
    this.shadowRoot!.append(setupResult.template.doc);
    recoverCurrentInstance();
  }
}

export function defineElement(options: ComponentOptions) {
  customElements.define(options.name, class extends SRayElement{
    constructor() {
      super(options);
    }
  });
}
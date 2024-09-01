import { AttrDefinition, ExtractAttrNames, ExtractPropertyFromAttrDefinitions } from './defineAttributes.js';
import { Template } from './html.js';
import { ref } from './reactive.js';

/**
 * @public
 */
export interface SetupResult {
  template: Template;
}

export let currentInstance: ElementInstance<any>;
const instanceStack: ElementInstance<any>[] = [];

export function setCurrentInstance<AttrDefinitions extends AttrDefinition[]>(
  instance: ElementInstance<AttrDefinitions>,
) {
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
export class SRayElement<
  AttrDefinitions extends AttrDefinition[],
> extends HTMLElement {
  [key: string]: any;

  #cleanups: Set<CallableFunction> = new Set();
  #setupResult: SetupResult | null = null;

  #attrs: Record<string, AttrDefinition> = {};

  constructor(public options: ComponentOptions<AttrDefinitions>) {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback<
    K extends keyof ElementInstance<AttrDefinitions>,
    V extends ElementInstance<AttrDefinitions>[K],
  >(this: ElementInstance<AttrDefinitions>) {
    setCurrentInstance(this);
    this.options.attrs?.forEach(attr => {
      this.#attrs[attr.name] = attr;
      // setup default value
      this[attr.propertyName as K] = attr.default as V;
    });
    this.#setupResult = this.options.setup(this);
    this.#setupResult.template.mountTo(this.shadowRoot!);
    recoverCurrentInstance();
  }

  disconnectedCallback() {
    this.#cleanups.forEach(cleanup => cleanup());
  }

  attributeChangedCallback<
    K extends keyof ElementInstance<AttrDefinitions>,
    V extends ElementInstance<AttrDefinitions>[K],
  >(this: ElementInstance<AttrDefinitions>, name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    const definition = this.#attrs[name];
    switch (definition.type) {
      case Boolean:
        // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes
        this[definition.propertyName as K] = (newValue !== null) as V;
        break;
      case Number:
      case String:
        this[definition.propertyName as K] = definition.type(newValue === null ? definition.default : newValue) as V;
        break;
    }
  }

  registerCleanup(cleanup: CallableFunction) {
    this.#cleanups.add(cleanup);
    this.#setupResult?.template.unmount();
  }
}

/**
 * @public
 */
export interface ComponentOptions<AttrDefinitions extends AttrDefinition[]> {
  name: string;
  attrs?: AttrDefinitions;
  setup: (hostElement: ElementInstance<AttrDefinitions>) => SetupResult;
}

/**
 * @public
 */
// The constroctor type of the SRayElement
export type ElementConstructor<AttrDefinitions extends AttrDefinition[]> = {
  observedAttributes: ExtractAttrNames<AttrDefinitions>[],
  new(): SRayElement<AttrDefinitions> & ExtractPropertyFromAttrDefinitions<AttrDefinitions>,
};

/**
 * @public
 */
export type ElementInstance<AttrDefinitions extends AttrDefinition[]> = InstanceType<
  ElementConstructor<AttrDefinitions>
>;

/**
 * @public
 */
export function defineElement<
  AttrDefinitions extends AttrDefinition[],
>(options: ComponentOptions<AttrDefinitions>): ElementConstructor<AttrDefinitions> {
  const Element = class extends SRayElement<AttrDefinitions> {
    static observedAttributes = options.attrs?.map(attr => attr.name) ?? [];
    constructor() {
      super(options);
      setupReactivePropsForAttributes<AttrDefinitions>(this, options);
    }
  };
  customElements.define(options.name, Element);
  return Element as ElementConstructor<AttrDefinitions>;
}

export function setupReactivePropsForAttributes<
  AttrDefinitions extends AttrDefinition[],
>(element: SRayElement<AttrDefinitions>, options: ComponentOptions<AttrDefinitions>) {
  const { attrs } = options;
  if (!attrs) return;

  attrs.forEach(attr => {
    const innerValue = ref<AttrDefinition['default'] | null>(null);
    Object.defineProperty(element, attr.propertyName, {
      get() {
        return innerValue.value;
      },
      set(value) {
        if (value === innerValue.value) return;
        innerValue.value = value;
        if (attr.type === Boolean) {
          // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes
          if (value) {
            element.setAttribute(attr.name, '');
          } else {
            element.removeAttribute(attr.name);
          }
          return true;
        }
        element.setAttribute(attr.name, String(value));
        return true;
      },
    });
  });
}

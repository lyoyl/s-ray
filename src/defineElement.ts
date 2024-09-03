import { AttrDefinition, ExtractAttrNames, ExtractPropertyFromAttrDefinitions } from './defineAttributes.js';
import { ExtractPropertiesFromPropDefinitions, PropDefinition } from './defineProperty.js';
import { Template } from './html.js';
import { ref } from './reactive.js';

/**
 * @public
 */
export interface SetupResult {
  template: Template;
}

export let currentInstance: ElementInstance<any, any>;
const instanceStack: ElementInstance<any, any>[] = [];

export function setCurrentInstance<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
>(
  instance: ElementInstance<AttrDefinitions, PropDefinitions>,
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
  PropDefinitions extends PropDefinition[],
> extends HTMLElement {
  [key: string]: any;

  #cleanups: Set<CallableFunction> = new Set();
  #setupResult: SetupResult | null = null;

  #attrs: Record<string, AttrDefinition> = {};

  #connectedCbs: Set<CallableFunction> = new Set();
  #disconnectedCbs: Set<CallableFunction> = new Set();

  constructor(public options: ComponentOptions<AttrDefinitions, PropDefinitions>) {
    super();
    this.attachShadow({ mode: 'open' });
    options.styles?.forEach(style => {
      this.shadowRoot!.adoptedStyleSheets.push(style);
    });
  }

  addConnectedCallback(cb: CallableFunction) {
    this.#connectedCbs.add(cb);
  }

  addDisconnectedCallback(cb: CallableFunction) {
    this.#disconnectedCbs.add(cb);
  }

  connectedCallback<
    K extends keyof ElementInstance<AttrDefinitions, PropDefinitions>,
    V extends ElementInstance<AttrDefinitions, PropDefinitions>[K],
  >(this: ElementInstance<AttrDefinitions, PropDefinitions>) {
    setCurrentInstance(this);
    this.options.attrs?.forEach(attr => {
      this.#attrs[attr.name] = attr;
      // setup default value
      this[attr.propertyName as K] = attr.default as V;
    });
    this.#setupResult = this.options.setup(this);
    this.#setupResult.template.mountTo(this.shadowRoot!);
    this.#connectedCbs.forEach(cb => cb());
    recoverCurrentInstance();
  }

  disconnectedCallback() {
    this.#cleanups.forEach(cleanup => cleanup());
    this.#disconnectedCbs.forEach(cb => cb());
    this.#cleanups.clear();
    this.#connectedCbs.clear();
    this.#disconnectedCbs.clear();
  }

  attributeChangedCallback<
    K extends keyof ElementInstance<AttrDefinitions, PropDefinitions>,
    V extends ElementInstance<AttrDefinitions, PropDefinitions>[K],
  >(
    this: ElementInstance<AttrDefinitions, PropDefinitions>,
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
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
export interface ComponentOptions<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
> {
  name: string;
  attrs?: AttrDefinitions;
  props?: PropDefinitions;
  styles?: CSSStyleSheet[];
  setup: (hostElement: ElementInstance<AttrDefinitions, PropDefinitions>) => SetupResult;
}

/**
 * @public
 */
// The constroctor type of the SRayElement
export type ElementConstructor<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
> = {
  observedAttributes: ExtractAttrNames<AttrDefinitions>[],
  new():
    & SRayElement<AttrDefinitions, PropDefinitions>
    & ExtractPropertyFromAttrDefinitions<AttrDefinitions>
    & ExtractPropertiesFromPropDefinitions<PropDefinitions>,
};

/**
 * @public
 */
export type ElementInstance<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
> = InstanceType<
  ElementConstructor<AttrDefinitions, PropDefinitions>
>;

/**
 * @public
 */
export function defineElement<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
>(options: ComponentOptions<AttrDefinitions, PropDefinitions>): ElementConstructor<AttrDefinitions, PropDefinitions> {
  const Element = class extends SRayElement<AttrDefinitions, PropDefinitions> {
    static observedAttributes = options.attrs?.map(attr => attr.name) ?? [];
    constructor() {
      super(options);
      setupReactivePropsForAttributes<AttrDefinitions, PropDefinitions>(this, options);
      setupReactiveProps<AttrDefinitions, PropDefinitions>(this, options);
    }
  };
  customElements.define(options.name, Element);
  return Element as ElementConstructor<AttrDefinitions, PropDefinitions>;
}

function setupReactivePropsForAttributes<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
>(element: SRayElement<AttrDefinitions, PropDefinitions>, options: ComponentOptions<AttrDefinitions, PropDefinitions>) {
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

function setupReactiveProps<
  AttrDefinitions extends AttrDefinition[],
  PropDefinitions extends PropDefinition[],
>(element: SRayElement<AttrDefinitions, PropDefinitions>, options: ComponentOptions<AttrDefinitions, PropDefinitions>) {
  const { props } = options;
  if (!props) return;

  props.forEach(prop => {
    const innerValue = ref<PropDefinition['default']>(prop.default);
    Object.defineProperty(element, prop.name, {
      get() {
        return innerValue.value;
      },
      set(value) {
        if (value === innerValue.value) return;
        innerValue.value = value;
        return true;
      },
    });
  });
}

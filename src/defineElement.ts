import { Template } from './html.js';
import { ref } from './reactive.js';
import { HyphenToCamelCase, hypheToCamel } from './utils.js';

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
// dprint-ignore
export type ExtractAttrDefault<T> = T extends BooleanConstructor
  ? boolean
  : T extends NumberConstructor
    ? number
    : T extends StringConstructor
      ? string
      : never;

/**
 * @public
 */
export interface AttrDefinition<
  N extends string = string,
  T = BooleanConstructor | NumberConstructor | StringConstructor,
  D = ExtractAttrDefault<T>,
  P = HyphenToCamelCase<N>,
> {
  name: N;
  type: T;
  default: D;
  propertyName: P;
}

/**
 * @public
 */
export type ExtractAttrName<AttrD> = AttrD extends AttrDefinition<infer N, any, any, any> ? N : never;

/**
 * @public
 */
export type ExtractAttrNames<AttrDefinitions> = AttrDefinitions extends [infer AttrD, ...infer Rest]
  ? ExtractAttrName<AttrD> | ExtractAttrNames<Rest>
  : never;

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
// dprint-ignore
export type ExtractPropertyFromAttrDefinition<AttrD> = AttrD extends AttrDefinition<infer N, infer T, infer D, infer P>
  ? P extends string
    ? { [K in P]: D }
    : never
  : never;

/**
 * @public
 */
export type ExtractPropertyFromAttrDefinitions<AttrDefinitions> = AttrDefinitions extends [infer AttrD, ...infer Rest]
  ? ExtractPropertyFromAttrDefinition<AttrD> & ExtractPropertyFromAttrDefinitions<Rest>
  : {};

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

function setupReactivePropsForAttributes<
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

/**
 * @public
 */
export function defineBooleanAttr<S extends string>(
  name: S,
  defaultValue: boolean,
): AttrDefinition<S, BooleanConstructor> {
  return {
    name,
    type: Boolean,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

/**
 * @public
 */
export function defineStringAttr<S extends string>(
  name: S,
  defaultValue: string,
): AttrDefinition<S, StringConstructor> {
  return {
    name,
    type: String,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

/**
 * @public
 */
export function defineNumberAttr<S extends string>(
  name: S,
  defaultValue: number,
): AttrDefinition<S, NumberConstructor> {
  return {
    name,
    type: Number,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

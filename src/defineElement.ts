import { Template } from './html.js';
import { HyphenToCamelCase, hypheToCamel } from './utils.js';

/**
 * @public
 */
export interface SetupResult {
  template: Template;
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
export class SRayElement<
  AttrDefinitions extends ReadonlyAttrDefinitions = ReadonlyAttrDefinitions,
> extends HTMLElement {
  #cleanups: Set<CallableFunction> = new Set();
  #setupResult: SetupResult | null = null;

  constructor(public options: ComponentOptions<AttrDefinitions>) {
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
export type ReadonlyAttrDefinitions = readonly AttrDefinition<string, any, any, any>[];

/**
 * @public
 */
export interface ComponentOptions<AttrDefinitions> {
  name: string;
  attrs?: AttrDefinitions;
  setup: () => SetupResult;
}

// dprint-ignore
type ExtractPropertyFromAttrDefinition<AttrD> = AttrD extends AttrDefinition<infer N, infer T, infer D, infer P>
  ? P extends string
    ? { [K in P]: D }
    : never
  : never;

type ExtractPropertyFromAttrDefinitions<AttrDefinitions> = AttrDefinitions extends readonly [infer AttrD, ...infer Rest]
  ? ExtractPropertyFromAttrDefinition<AttrD> & ExtractPropertyFromAttrDefinitions<Rest>
  : {};

/**
 * @public
 */
export function defineElement<
  AttrDefinitions extends ReadonlyAttrDefinitions,
  ElementInstance = { new(): SRayElement<AttrDefinitions> & ExtractPropertyFromAttrDefinitions<AttrDefinitions> },
>(options: ComponentOptions<AttrDefinitions>): ElementInstance {
  const Element = class extends SRayElement {
    constructor() {
      super(options);
    }
  };
  customElements.define(options.name, Element);
  return Element as ElementInstance;
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

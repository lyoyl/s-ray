import { error } from '../utils.js';

type Constructable = new(...args: any[]) => any;

// TODO: this needs to be unique per request
const globalRegistry = new Map<string, Constructable>();

const customElementsSSR = {
  define(name: string, constructor: Constructable) {
    if (__ENV__ === 'development') {
      globalRegistry.has(name) && error(`Custom element "${name}" has already been defined.`);
    }
    globalRegistry.set(name, constructor);
    return constructor;
  },
  get(name: string) {
    return globalRegistry.get(name);
  },
} as unknown as CustomElementRegistry;

export const customElements = __SSR__ ? customElementsSSR : window.customElements;

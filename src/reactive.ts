import { Template } from './html.js';

export let currentTemplate: Template | null = null;
export function setCurrentTemplate(template: Template | null) {
  currentTemplate = template;
}

export let currentDynamicPartSpecifier: string | null = null;
export function setCurrentDynamicPartSpecifier(specifier: string | null) {
  currentDynamicPartSpecifier = specifier;
}

type DynamicSpecifiers = Set<string>;
type Deps = Map<Template, DynamicSpecifiers>;

export class Ref<T = unknown> {
  #value: T;
  #deps: Deps = new Map();
  constructor(value: T) {
    this.#value = value;
  }

  get value() {
    if (currentTemplate && currentDynamicPartSpecifier) {
      let deps = this.#deps.get(currentTemplate);
      if (!deps) {
        deps = new Set();
        this.#deps.set(currentTemplate, deps);
      }
      deps.add(currentDynamicPartSpecifier);
    }
    return this.#value;
  }

  set value(newValue: T) {
    this.#value = newValue;
    for (const [template, dynamicSpecifiers] of this.#deps) {
      dynamicSpecifiers.forEach(specifier => {
        template.triggerRender(specifier);
      });
    }
  }
}

export function ref<T = unknown>(value: T) {
  return new Ref<T>(value);
}

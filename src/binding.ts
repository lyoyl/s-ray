import { XBaseElement } from './XBaseElement';

export function binding(baseElement: XBaseElement, key: string) {
  let value = baseElement[key];
  Object.defineProperty(baseElement, key, {
    get() {
      return value;
    },
    set(newValue) {
      value = newValue;
      baseElement.render.call(this, key, newValue);
    },
  });
}

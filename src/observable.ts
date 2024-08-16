import { XBaseElement } from './XBaseElement';

export function observable(baseElement: XBaseElement, key: string) {
  let value = baseElement[key];
  console.log(baseElement, value, key);
  Object.defineProperty(baseElement, key, {
    get() {
      return value;
    },
    set(newValue) {
      value = newValue;
      baseElement.render();
    },
  });
}

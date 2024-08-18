import { SBaseElement } from './SBaseElement.js';

let computerNameStack: string[] = [];

export function reactive(target: SBaseElement, key: string) {
  let value = target[key];
  const computers = new Set<string>();
  Object.defineProperty(target, key, {
    get() {
      computerNameStack.forEach(computerName => computers.add(computerName));
      return value;
    },
    set(newValue) {
      if (newValue === value) {
        return;
      }
      value = newValue;
      target.render.call(this, key, newValue, computers);
    },
  });
}

export function computed(target: SBaseElement, key: string, descriptor: PropertyDescriptor) {
  const originalGet = descriptor.get!;
  // TODO: Check and make sure the originalGet is a function
  descriptor.get = function() {
    computerNameStack.push(key);
    const value = originalGet.call(this);
    computerNameStack.pop();
    return value;
  };
}

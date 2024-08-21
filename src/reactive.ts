import { currentInstance } from "./defineElement.js";

let uniqueId = 0;

function ref(value: unknown) {
  let _val = value;
  const symbol = Symbol.for(`ref-${uniqueId++}`);
  return {
    get value() {
      return _val;
    },
    set value(newValue) {
      _val = newValue;
    },
 };
}
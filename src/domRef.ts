export class DomRef<T extends Element = Element> {
  value: T | null = null;
}

export function domRef<T extends Element>(): DomRef<T> {
  return new DomRef();
}

export function isDomRef(value: unknown): value is DomRef<Element> {
  return value instanceof DomRef;
}

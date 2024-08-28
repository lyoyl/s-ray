export let currentTarget: Target | null = null;
export function setCurrentTarget(target: Target | null) {
  currentTarget = target;
}

export let currentSpecifier: string | null = null;
export function setCurrentSpecifier(specifier: string | null) {
  currentSpecifier = specifier;
}

/**
 * For the relationship between the template and the ref:
 * - the specifier is the dynamic part of the template
 * - the target is the template instance
 *
 * For the relationship between the ref and the watcher:
 * - We artificially create a target and a specifier
 */
type Specifier = string;
type Specifiers = Set<Specifier>;
type Target = {
  update(specifier: string): any,
  isInUse: boolean,
};
type Deps = Map<Target, Specifiers>;

/**
 * @public
 */
export class Ref<T = unknown> {
  #value: T;
  #deps: Deps = new Map();
  constructor(value: T) {
    this.#value = value;
  }

  get value() {
    if (currentTarget && currentSpecifier) {
      let deps = this.#deps.get(currentTarget);
      if (!deps) {
        deps = new Set();
        this.#deps.set(currentTarget, deps);
      }
      deps.add(currentSpecifier);
    }
    return this.#value;
  }

  set value(newValue: T) {
    this.#value = newValue;
    for (const [target, specifiers] of this.#deps) {
      // Prune the target if it is no longer in use
      if (!target.isInUse) {
        this.#deps.delete(target);
        continue;
      }
      specifiers.forEach(specifier => {
        target.update(specifier);
      });
    }
  }
}

/**
 * @public
 */
export function ref<T = unknown>(value: T) {
  return new Ref<T>(value);
}

let uniqueSpecifierId = 0;

/**
 * @public
 */
export type UnwatchFn = () => void;

/**
 * @public
 */
export type WatchCallback<V> = (oldValue: V | null, newValue: V, onInvalidate: OnInvalidateFn) => void;

/**
 * @public
 */
export type OnInvalidateFn = (cb: CallableFunction) => void;

/**
 * @public
 */
export function watch<
  T extends Ref<any>,
  V = T extends Ref<infer R> ? R : never,
>(ref: T, callback: WatchCallback<V>): UnwatchFn;
/**
 * @public
 */
export function watch<
  Getter extends (...args: any[]) => any,
  R = ReturnType<Getter>,
>(getter: Getter, callback: WatchCallback<R>): UnwatchFn;

export function watch(getterOrRef: any, callback: any) {
  const isRef = getterOrRef instanceof Ref;
  const getter = isRef ? () => getterOrRef.value : getterOrRef;
  let isFirstRun = true;
  let oldValue: unknown = null;
  let invalidateFn: CallableFunction | null = null;
  function onInvalidate(cb: CallableFunction) {
    invalidateFn = cb;
  }

  const target: Target = {
    update(specifier: string) {
      setCurrentTarget(target);
      setCurrentSpecifier(specifier);
      const value = getter();
      setCurrentTarget(null);
      setCurrentSpecifier(null);
      if (invalidateFn) {
        invalidateFn();
      }
      !isFirstRun && callback(value, oldValue, onInvalidate);
      oldValue = value;
      isFirstRun = false;
    },
    isInUse: true,
  };
  const specifier = `_watcher_${uniqueSpecifierId++}_`;
  target.update(specifier);

  function unwatch() {
    target.isInUse = false;
  }
  return unwatch;
}

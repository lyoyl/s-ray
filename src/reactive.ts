import { currentInstance } from './defineElement.js';
import { Priority, queueTask } from './scheduler.js';
import { isObject } from './utils.js';

/**
 * For the relationship between the template and the ref:
 * - the specifier is the dynamic part of the template
 * - the target is the template instance
 *
 * For the relationship between the ref and the watcher:
 * - We artificially create a target and a specifier
 */
type Specifier = string;
type Target = {
  update(specifier: string): any,
  isInUse: boolean,
};
interface ReactiveContext {
  target?: Target;
  specifier?: Specifier;
}

const reactiveContextStack: ReactiveContext[] = [];

export function pushReactiveContextStack(ctx: ReactiveContext) {
  reactiveContextStack.push(ctx);
}

export function popReactiveContextStack() {
  reactiveContextStack.pop();
}

type Specifiers = Set<Specifier>;
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
    const { target: currentTarget, specifier: currentSpecifier } = reactiveContextStack.at(-1) || {};
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

let uniqueSpecifierId = 0;

/**
 * @public
 */
export function ref<T = unknown>(value: T) {
  return new Ref<T>(value);
}

/**
 * @public
 */
export interface ComputedRef<T> {
  readonly value: T;
  __isComputed: true;
}

function isComputed(value: any): value is ComputedRef<any> {
  return isObject(value) && value.__isComputed;
}

/**
 * @public
 */
export function computed<T>(getter: () => T): ComputedRef<T> {
  const signal = ref(0);

  let isDirty = true;
  let innerValue: T;
  const specifier = `_computed_${uniqueSpecifierId++}_`;
  const target: Target = {
    update(_specifier: string) {
      isDirty = true;
      signal.value++;
    },
    isInUse: true,
  };

  currentInstance?.registerCleanup(() => target.isInUse = false);

  const reactiveContext: ReactiveContext = {
    target,
    specifier,
  };

  return {
    get value() {
      signal.value; // trigger the access
      if (!isDirty) {
        return innerValue;
      }
      pushReactiveContextStack(reactiveContext);
      isDirty = false;
      innerValue = getter();
      popReactiveContextStack();
      return innerValue;
    },
    __isComputed: true,
  };
}

/**
 * @public
 */
export type UnwatchFn = () => void;

/**
 * @public
 */
export type WatchCallback<V> = (newValue: V, oldValue: V | null, onInvalidate: OnInvalidateFn) => void;

/**
 * @public
 */
export type OnInvalidateFn = (cb: CallableFunction) => void;

/**
 * @public
 */
export interface WatchOptions {
  priority?: Priority;
}

/**
 * @public
 */
export function watch<
  T extends ComputedRef<any>,
  V = T extends ComputedRef<infer R> ? R : never,
>(computed: T, callback: WatchCallback<V>, options?: WatchOptions): UnwatchFn;
/**
 * @public
 */
export function watch<
  T extends Ref<any>,
  V = T extends Ref<infer R> ? R : never,
>(ref: T, callback: WatchCallback<V>, options?: WatchOptions): UnwatchFn;
/**
 * @public
 */
export function watch<
  Getter extends (...args: any[]) => any,
  R = ReturnType<Getter>,
>(getter: Getter, callback: WatchCallback<R>, options?: WatchOptions): UnwatchFn;

export function watch(getterOrRef: any, callback: any, options?: WatchOptions) {
  const { priority = Priority.Low } = options || {};

  const isRef = getterOrRef instanceof Ref || isComputed(getterOrRef);
  const getter = isRef ? () => getterOrRef.value : getterOrRef;
  let isFirstRun = true;
  let oldValue: unknown = null;
  let invalidateFn: CallableFunction | null = null;
  function onInvalidate(cb: CallableFunction) {
    invalidateFn = cb;
  }

  const specifier = `_watcher_${uniqueSpecifierId++}_`;

  const taskRunner = () => {
    pushReactiveContextStack({
      target,
      specifier,
    });
    const value = getter();
    popReactiveContextStack();
    if (invalidateFn) {
      invalidateFn();
    }
    (!isFirstRun || priority === Priority.Immediate) && callback(value, oldValue, onInvalidate);
    oldValue = value;
    isFirstRun = false;
  };

  const target: Target = {
    update(_specifier: string) {
      queueTask(taskRunner, priority);
    },
    isInUse: true,
  };
  taskRunner();

  function unwatch() {
    target.isInUse = false;
  }

  currentInstance?.registerCleanup(unwatch);

  return unwatch;
}

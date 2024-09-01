/**
 * @public
 */
export interface PropDefinition<N extends string = string, T extends any = any> {
  name: N;
  default?: T;
}

/**
 * @public
 */
export type ExtractPropertiesFromPropDefinition<PropDefinition> = PropDefinition extends
  { name: infer N, default?: infer D } ? N extends string ? { [K in N]: D }
  : never
  : never;

/**
 * @public
 */
export type ExtractPropertiesFromPropDefinitions<PropDefinitions> = PropDefinitions extends
  [infer PropDefinition, ...infer Rest]
  ? ExtractPropertiesFromPropDefinition<PropDefinition> & ExtractPropertiesFromPropDefinitions<Rest>
  : {};

/**
 * @public
 */
export function defineProperty<T, N extends string>(name: N, defaultValue?: T): PropDefinition<N, T> {
  return {
    name,
    default: defaultValue,
  };
}

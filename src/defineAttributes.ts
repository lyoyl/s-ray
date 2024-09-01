import { HyphenToCamelCase, hypheToCamel } from './utils.js';

/**
 * @public
 */
// dprint-ignore
export type ExtractAttrDefault<T> = T extends BooleanConstructor
  ? boolean
  : T extends NumberConstructor
    ? number
    : T extends StringConstructor
      ? string
      : never;

/**
 * @public
 */
export interface AttrDefinition<
  N extends string = string,
  T = BooleanConstructor | NumberConstructor | StringConstructor,
  D = ExtractAttrDefault<T>,
  P = HyphenToCamelCase<N>,
> {
  name: N;
  type: T;
  default: D;
  propertyName: P;
}

/**
 * @public
 */
export type ExtractAttrName<AttrD> = AttrD extends AttrDefinition<infer N, any, any, any> ? N : never;

/**
 * @public
 */
export type ExtractAttrNames<AttrDefinitions> = AttrDefinitions extends [infer AttrD, ...infer Rest]
  ? ExtractAttrName<AttrD> | ExtractAttrNames<Rest>
  : never;

/**
 * @public
 */
// dprint-ignore
export type ExtractPropertyFromAttrDefinition<AttrD> = AttrD extends AttrDefinition<infer N, infer T, infer D, infer P>
? P extends string
  ? { [K in P]: D }
  : never
: never;

/**
 * @public
 */
export type ExtractPropertyFromAttrDefinitions<AttrDefinitions> = AttrDefinitions extends [infer AttrD, ...infer Rest]
  ? ExtractPropertyFromAttrDefinition<AttrD> & ExtractPropertyFromAttrDefinitions<Rest>
  : {};

/**
 * @public
 */
export function defineBooleanAttr<S extends string>(
  name: S,
  defaultValue: boolean,
): AttrDefinition<S, BooleanConstructor> {
  return {
    name,
    type: Boolean,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

/**
 * @public
 */
export function defineStringAttr<S extends string>(
  name: S,
  defaultValue: string,
): AttrDefinition<S, StringConstructor> {
  return {
    name,
    type: String,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

/**
 * @public
 */
export function defineNumberAttr<S extends string>(
  name: S,
  defaultValue: number,
): AttrDefinition<S, NumberConstructor> {
  return {
    name,
    type: Number,
    default: defaultValue,
    propertyName: hypheToCamel<S>(name),
  };
}

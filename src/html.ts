import { SBaseElement } from './SBaseElement.js';

type PropertiesOf<T extends SBaseElement> = {
  [key in keyof T]: T[key];
};
type NoStringIndex<T> = { [K in keyof T as string extends K ? never : K]: T[K] };

export const tplPrefix = '$$--';
export const tplSuffix = '--$$';
export const bindingRE = /\$\$--(.+)--\$\$/g;

export function html<T extends SBaseElement>(
  strings: TemplateStringsArray,
  ...values: (keyof NoStringIndex<PropertiesOf<T>>)[]
) {
  const templateString = String.raw(
    { raw: strings },
    ...values.map(value => `${tplPrefix}${String(value)}${tplSuffix}`),
  );
  const template = document.createElement('template');
  template.innerHTML = templateString;
  return template.content;
}

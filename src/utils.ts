export function createTextNode(text: string) {
  return document.createTextNode(text);
}

export function createComment(text: string) {
  return document.createComment(text);
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

export function error(message: string, ...args: any[]) {
  console.error(`[s-ray error]: ${message}`, ...args);
}

const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
export function sanitizeHtml(htmlString: string) {
  return htmlString.replace(/[&<>"']/g, (match) => escapeMap[match as keyof typeof escapeMap]);
}

/**
 * @public
 */
export type HyphenToCamelCase<S extends string> = S extends `${infer P1}-${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${HyphenToCamelCase<P3>}`
  : S;

export function hypheToCamel<S extends string>(str: S): HyphenToCamelCase<S> {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) as HyphenToCamelCase<S>;
}

export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object';
}
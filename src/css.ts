const styleSheetsCache = new Map<string, CSSStyleSheet>();

/**
 * @public
 */
export function css(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  const styleString = String.raw({ raw: strings }, ...values);
  if (__SSR__) {
    return styleString as unknown as CSSStyleSheet;
  }
  if (styleSheetsCache.has(styleString)) {
    return styleSheetsCache.get(styleString)!;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styleString);
  styleSheetsCache.set(styleString, sheet);
  return sheet;
}

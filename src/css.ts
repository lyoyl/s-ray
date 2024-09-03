const styleSheetsCache = new Map<string, CSSStyleSheet>();

/**
 * @public
 */
export function css(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  const styleString = String.raw({ raw: strings }, ...values);
  if (styleSheetsCache.has(styleString)) {
    return styleSheetsCache.get(styleString)!;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styleString);
  styleSheetsCache.set(styleString, sheet);
  return sheet;
}

class SSRShadowRoot {
  adoptedStyleSheets: CSSStyleSheet[] = [];
}

class SSRElementInternals {
  shadowRoot: SSRShadowRoot | null;
  constructor(shadowRoot: SSRShadowRoot | null) {
    this.shadowRoot = shadowRoot;
  }
}

class SSRHTMLElement {
  #internalAttrs: Record<string, string> = {};

  shadowRoot: SSRShadowRoot | null = null;
  internals: SSRElementInternals | null = null;
  attachShadow(options: ShadowRootInit) {
    this.shadowRoot = new SSRShadowRoot();
  }
  attachInternals() {
    this.internals = new SSRElementInternals(this.shadowRoot);
    return this.internals;
  }

  setAttribute(name: string, value: unknown) {
    this.#internalAttrs[name] = String(value);
  }

  getAttribute(name: string) {
    return this.#internalAttrs[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.#internalAttrs[name];
  }
}

/**
 * @public
 */
export const SRayHTMLElement = (__SSR__ ? SSRHTMLElement : HTMLElement) as unknown as typeof HTMLElement;

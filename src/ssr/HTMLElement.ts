class SSRShadowRoot {
  adoptedStyleSheets: CSSStyleSheet[] = [];
}

class SSRHTMLElement {
  shadowRoot: SSRShadowRoot | null = null;
  attachShadow(options: ShadowRootInit) {
    this.shadowRoot = new SSRShadowRoot();
  }
  attachInternals() {}
}

/**
 * @public
 */
export const SRayHTMLElement = (__SSR__ ? SSRHTMLElement : HTMLElement) as unknown as typeof HTMLElement;

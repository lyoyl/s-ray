export const trustedTypePolicy = (window as any).trustedTypes!.createPolicy('s-ray', {
  createHTML: (html: string) => html,
});

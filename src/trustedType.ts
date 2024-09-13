import { trustedType } from './ssr/trustedType.js';

export const trustedTypePolicy = trustedType.createPolicy('s-ray', {
  createHTML: (html: string) => html,
});

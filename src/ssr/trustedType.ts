const trustedTypeSSR = {
  createPolicy: (name: string, policy: any) => {
    return policy;
  },
};

export const trustedType = __SSR__ ? trustedTypeSSR : (window as any).trustedTypes!;

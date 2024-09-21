import { esbuildPlugin } from '@web/dev-server-esbuild';
import { URL, fileURLToPath } from 'url';
import { baseConfig } from './web-test-runner.config.js';

export default {
  ...baseConfig,
  files: ['src/ssr/**/*.spec.ts', '!src/ssr/**/hydrating.spec.ts'],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: fileURLToPath(
        new URL('./tsconfig.json', import.meta.url),
      ),
      target: 'auto',
      define: {
        '__ENV__': JSON.stringify('development'),
        '__SSR__': JSON.stringify(true),
      },
    }),
  ],
};

import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { URL, fileURLToPath } from 'url';

export const baseConfig = {
  files: ['src/**/*.spec.ts'],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: fileURLToPath(
        new URL('./tsconfig.json', import.meta.url),
      ),
      target: 'auto',
      define: {
        'process.env.NODE_ENV': JSON.stringify('test'),
      },
    }),
  ],
  browsers: [
    playwrightLauncher(),
  ],
  nodeResolve: {
    exportConditions: ['production'],
  },
  coverage: true,
  coverageConfig: {
    include: ['src/**/*.ts'],
    exclude: [
      '**/node_modules/**/*',
      '**/test/**/*',
      '**/*.d.ts',
    ],
    threshold: { statements: 0, functions: 0, branches: 0, lines: 0 },
  },
  playwright: true,
  testFramework: {
    config: {
      timeout: '10000',
    },
  },
};

export default baseConfig;

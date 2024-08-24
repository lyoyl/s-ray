import { build } from 'esbuild';

const buildConfigs = [
  {
    __DEV__: `'development'`,
    format: 'esm',
    outfile: 'dist/s-ray.js',
  },
  {
    __DEV__: `'production'`,
    format: 'esm',
    outfile: 'dist/s-ray.min.js',
    minify: true,
  },
  {
    __DEV__: 'process.env.NODE_ENV',
    format: 'esm',
    outfile: 'dist/s-ray-bundler.js',
  },
];

for (const config of buildConfigs) {
  await build({
    entryPoints: ['src/index.ts'],
    target: 'esnext',
    format: config.format,
    bundle: true,
    minify: !!config.minify,
    sourcemap: true,
    outfile: config.outfile,
    define: {
      __DEV__: config.__DEV__,
    },
  });
}

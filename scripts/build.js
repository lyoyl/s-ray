import { build } from 'esbuild';
import { statSync } from 'node:fs';

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
  const results = await build({
    entryPoints: ['src/index.ts'],
    target: 'esnext',
    format: config.format,
    bundle: true,
    minify: !!config.minify,
    sourcemap: true,
    outfile: config.outfile,
    metafile: true,
    define: {
      __DEV__: config.__DEV__,
    },
  });

  const fileSizes = [];
  Object.keys(results.metafile?.outputs).filter(v => !v.endsWith('.map')).forEach((path) => {
    const stat = statSync(path);
    const size = stat.size / 1024;
    fileSizes.push({ path, size });
  });
  fileSizes.forEach(({ path, size }) => {
    console.info(`\t- ${path}:`, `${size.toFixed(2)} KB`);
  });
}

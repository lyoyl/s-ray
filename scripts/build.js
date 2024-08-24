import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  target: 'esnext',
  format: 'esm',
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/s-ray.js',
});

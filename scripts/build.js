import { build } from 'esbuild';
import { statSync } from 'node:fs';

const baseBuildConfigs = [
  {
    __ENV__: `'development'`,
    format: 'esm',
    outfile: 'dist/s-ray',
  },
  {
    __ENV__: `'production'`,
    format: 'esm',
    outfile: 'dist/s-ray.min',
    minify: true,
  },
  {
    __ENV__: 'process.env.NODE_ENV',
    format: 'esm',
    outfile: 'dist/s-ray-bundler',
  },
];

function createSSRConfig(baseBuildConfigs) {
  return baseBuildConfigs.filter(config => !isForBundler(config)).map(config => ({
    ...config,
    format: 'esm',
    outfile: `${config.outfile}.ssr`,
  }));
}

const finalBuildConfigs = [
  ...baseBuildConfigs,
  ...createSSRConfig(baseBuildConfigs),
].map(config => ({
  ...config,
  outfile: `${config.outfile}.js`,
}));

function isForBundler(config) {
  return config.outfile.includes('bundler');
}

for (const config of finalBuildConfigs) {
  const isBundler = isForBundler(config);
  const isSSR = config.outfile.includes('.ssr');

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
      __ENV__: config.__ENV__,
      __SSR__: isBundler ? 'process.env.SRAY_SSR' : `${isSSR}`,
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

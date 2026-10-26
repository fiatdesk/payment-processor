import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['sdks/node/src/index.ts'],
  outDir: 'sdks/node/dist',
  format: ['cjs', 'esm'],
  dts: { resolve: true },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  tsconfig: 'sdks/node/tsconfig.lib.json',
  noExternal: ['@zoneless/shared-types'],
  external: ['@solana/web3.js', 'bs58'],
});

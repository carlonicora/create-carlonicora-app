import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      composite: false,
      // tsup's dts build sets `baseUrl: compilerOptions.baseUrl || "."`
      // unconditionally (tsup/dist/rollup.js), and TypeScript 6 makes `baseUrl`
      // a hard error (TS5101). None of this repo's tsconfigs set it any more —
      // this suppression belongs to tsup, not to us, so it is scoped here
      // rather than reintroduced into a tsconfig. Removable when tsup stops
      // injecting baseUrl; tsup must be replaced before TypeScript 7 regardless,
      // because 7 deleted the JavaScript compiler API that its dts build needs.
      ignoreDeprecations: "6.0",
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
});

import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";
import path from "path";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  // Vitest 4 replaced esbuild with Oxc as the built-in transformer, so
  // unplugin-swc's `esbuild: false` is now inert and Oxc would transform TS
  // instead — emitting a `design:paramtypes` array of `undefined`s and breaking
  // every DI token resolved through reflection. SWC must own the transform for
  // `decoratorMetadata` above to have any effect.
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["test/**/*.e2e-spec.ts"],
    passWithNoTests: true,
    silent: true,
    reporters: ["default"],
    onConsoleLog: () => false,
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
});

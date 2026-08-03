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

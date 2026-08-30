import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A freshly scaffolded app ships this package with no tests yet, and
    // vitest exits 1 on "No test files found" by default — which failed
    // `pnpm test` at @<app>/shared#test in every generated app before a single
    // line was written. apps/api and apps/web already set this for the same
    // reason.
    passWithNoTests: true,
    silent: true,
    reporters: ["default"],
    onConsoleLog: () => false,
  },
});

import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  css: {
    // Disable PostCSS processing in tests to avoid plugin resolution issues
    postcss: {},
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "__tests__/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    silent: true,
    reporters: ["default"],
    onConsoleLog: () => false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.d.ts", "src/**/index.ts"],
    },
    server: {
      deps: {
        // Inline workspace packages so CI doesn't use pre-bundled npm versions
        inline: [/@carlonicora\/nextjs-jsonapi/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

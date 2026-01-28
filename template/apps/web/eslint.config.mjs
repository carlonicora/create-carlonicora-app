import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      i18next: i18next,
    },
    rules: {
      // Detect hardcoded strings in JSX (set to "warn" to find all, "off" for production)
      "i18next/no-literal-string": ["warn", {
        mode: "jsx-text-only",
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@next/next/no-assign-module-variable": "warn",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
      // Disable React Compiler rules (not needed unless using React Compiler)
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/use-memo": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "node_modules/**"],
  },
  {
    // Disable i18n literal string checks in test files
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
];

export default eslintConfig;

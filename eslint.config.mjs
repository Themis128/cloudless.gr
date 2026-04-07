import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Project-specific rules
  {
    rules: {
      // Warn on unused vars but allow underscore-prefixed ones
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Enforce Next.js Link usage
      "@next/next/no-html-link-for-pages": "error",

      // Disallow console.log in production code (allow warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Prefer const over let when no reassignment
      "prefer-const": "warn",

      // No var declarations
      "no-var": "error",

      // Require === instead of ==
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  // Override ignores of eslint-config-next
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "e2e/**",
    "playwright.config.ts",
    "public/sw.js",
  ]),
]);

export default eslintConfig;

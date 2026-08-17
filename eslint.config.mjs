import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next/index.js";

const eslintConfig = defineConfig([
  nextConfig,

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


  // Scripts/tools/workers — CLI utilities legitimately use console, any, require
  {
    files: ["scripts/**/*.{ts,mts,mjs,js}", "tools/**/*.{ts,mts,mjs,js}", "workers/**/*.{ts,mts,mjs,js}", "*.config.{ts,mts,mjs,js}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "import/no-anonymous-default-export": "off",
    },
  },

  // Tests — looser rules
  {
    files: ["__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
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
    ".venv/**",
    ".mypy_cache/**",
    ".ruff_cache/**",
    ".pochi/**",
    "scripts/**/dist/**",
    "tools/**/dist/**",
    "coverage/**",
    ".coverage-v8-server/**",
    ".coverage-run/**",
    "workers/**/dist/**"
  ]),
]);

export default eslintConfig;
// eslint-patch resolves plugins from eslint-config-next's own node_modules
// rather than requiring them at the root — needed for ESLint 8 + next/core-web-vitals.
require("@rushstack/eslint-patch/modern-module-resolution");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@next/next/no-html-link-for-pages": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "warn",
    "no-var": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
  },
  overrides: [
    {
      files: [
        "scripts/**/*.{ts,mts,mjs,js}",
        "tools/**/*.{ts,mts,mjs,js}",
        "workers/**/*.{ts,mts,mjs,js}",
        "*.config.{ts,mts,mjs,js}",
      ],
      rules: {
        "no-console": "off",
        "import/no-anonymous-default-export": "off",
      },
    },
    {
      files: ["__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: [
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
    "workers/**/dist/**",
  ],
};

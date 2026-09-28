// ESLint 9 flat config — replaces .eslintrc.js (legacy configs are unsupported
// by eslint-config-next 16, which ships native flat-config arrays).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "e2e/**",
      "playwright.config.ts",
      "playwright-report/**",
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
      "node_modules/**",
      "*.min.js",
      "*.bundle.js",
      "dist/**",
      ".wrangler/**",
      "public/*.js",
      "public/**/*.js",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
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
  },
  {
    rules: {
      // Newly enabled by the v16 flat bundles (typescript-eslint recommended +
      // react-hooks v6). The legacy .eslintrc never ran them — keep them visible
      // as warnings, not CI failures, until a dedicated cleanup pass lands.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
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
    files: ["__tests__/**/*.{ts,tsx,js,jsx}", "**/*.test.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      eqeqeq: "off",
      "no-var": "off",
    },
  },
];

export default eslintConfig;

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

  // Admin and dashboard pages — lenient rules for data fetching patterns
  {
    files: ["src/app/**/admin/**/*.{ts,tsx}", "src/app/**/dashboard/**/*.{ts,tsx}", "src/app/**/auth/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // API routes — lenient rules for JSON handling
  {
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Library files — lenient rules for external API JSON handling
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // i18n files — lenient rules for request handling
  {
    files: ["src/i18n/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Components — lenient rules for data fetching and state patterns
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Context files — lenient rules for state initialization
  {
    files: ["src/context/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Portal pages — lenient rules for data handling
  {
    files: ["src/app/portal/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Middleware — lenient rules for geo redirect and request handling
  {
    files: ["src/middleware/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Agents — lenient rules for workflow definitions
  {
    files: ["src/agents/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
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

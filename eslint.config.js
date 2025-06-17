import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default [
  // Base JavaScript config
  js.configs.recommended,
  
  // TypeScript config
  ...tseslint.configs.recommended,
  
  // Vue config
  ...pluginVue.configs["flat/recommended"],
  
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Vue-specific rules
      "vue/multi-word-component-names": "off",
      "vue/no-multiple-template-root": "off",
    },
  },
  
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  
  // Ignore patterns
  {
    ignores: [
      ".nuxt/**",
      ".output/**",
      "dist/**",
      "node_modules/**",
      "cypress/**",
      "playwright/**",
      "public/**",
    ],
  },
];

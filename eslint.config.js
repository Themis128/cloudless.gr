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
        // Nuxt 3 auto-imports
        definePageMeta: "readonly",
        defineNuxtConfig: "readonly",
        useHead: "readonly",
        useRoute: "readonly",
        useRouter: "readonly",
        navigateTo: "readonly",
        useRuntimeConfig: "readonly",
        useCookie: "readonly",
        useState: "readonly",
        useFetch: "readonly",
        useAsyncData: "readonly",
        useNuxtApp: "readonly",
        // Vue auto-imports
        ref: "readonly",
        reactive: "readonly",
        computed: "readonly",
        watch: "readonly",
        watchEffect: "readonly",
        onMounted: "readonly",
        onUnmounted: "readonly",
        onBeforeMount: "readonly",
        onBeforeUnmount: "readonly",
        nextTick: "readonly",
        // Custom composables (add your own here)
        useIcons: "readonly",
        useFetchProjects: "readonly",
        useProjectsStore: "readonly",
        useSupabaseAuth: "readonly",
        useCreateProject: "readonly",
        useTreeView: "readonly",
        useContactInfo: "readonly",
        useAuthGuard: "readonly",
        usePipeline: "readonly",
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
      // Vue-specific rules - more relaxed for better DX
      "vue/multi-word-component-names": "off",
      "vue/no-multiple-template-root": "off",
      "vue/max-attributes-per-line": ["warn", {
        singleline: 3,
        multiline: 1
      }],
      "vue/html-indent": ["warn", 2],
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/attributes-order": "warn",
      "vue/no-mutating-props": "error",
      "vue/v-on-event-hyphenation": "warn",
      "vue/attribute-hyphenation": "warn",
      "vue/html-self-closing": ["warn", {
        html: {
          void: "never",
          normal: "always",
          component: "always"
        },
        svg: "always",
        math: "always"
      }],
    },
  },
  
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    rules: {
      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": "allow-with-description",
        "ts-expect-error": "allow-with-description"
      }],
      "@typescript-eslint/no-require-imports": "warn",
      // Disable some overly strict rules for better DX
      "no-undef": "off", // TypeScript handles this
      "no-redeclare": "off", // TypeScript handles this
    },
  },

  // Scripts directory - more relaxed rules
  {
    files: ["scripts/**/*.js", "supabase/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-redeclare": "off",
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

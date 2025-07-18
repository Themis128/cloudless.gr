module.exports = {
  root: true,
  extends: ['@nuxt/eslint-config', 'plugin:vue/vue3-essential'],
  ignorePatterns: [
    'vanta-gallery/**/*',
    'node_modules/**/*',
    '.nuxt/**/*',
    '.output/**/*',
    'dist/**/*',
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    // Security rules
    'vue/no-v-html': 'error',
    'vue/no-mutating-props': 'error',
    'vue/component-name-in-template-casing': 'error',
    'vue/component-definition-name-casing': 'error',
    'vue/component-options-name-casing': 'error',
    'vue/custom-event-name-casing': 'error',
    'vue/define-macros-order': 'error',
    'vue/html-comment-content-spacing': 'error',
    'vue/no-restricted-v-bind': 'error',
    'vue/no-unused-properties': 'warn',
    'vue/no-useless-mustaches': 'error',
    'vue/no-useless-v-bind': 'error',
    'vue/padding-line-between-blocks': 'error',
    'vue/prefer-separate-static-class': 'error',
    'vue/v-for-delimiter-style': 'error',
    'vue/v-on-function-call': 'error',
    'vue/v-on-event-hyphenation': 'error',
    'vue/v-on-handler-style': 'error',
    // Vuetify 3 v-slot compatibility rules
    'vue/valid-v-slot': ['error', {
      allowModifiers: true
    }],
    'vue/v-slot-style': ['error', 'shorthand'],
    // Function declaration rules
    'func-style': ['error', 'expression'],
    'no-inner-declarations': 'error',
    // Formatting rules
    'vue/html-indent': ['error', 2],
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: 3,
        multiline: 1,
      },
    ],
    'vue/first-attribute-linebreak': [
      'error',
      {
        singleline: 'ignore',
        multiline: 'below',
      },
    ],
    'vue/multiline-html-element-content-newline': 'error',
    'vue/html-closing-bracket-newline': 'error',
    'vue/html-closing-bracket-spacing': 'error',
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
}

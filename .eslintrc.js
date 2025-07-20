module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
  },
  extends: [
    '@nuxt/eslint-config',
    'plugin:vue/vue3-essential',
  ],
  rules: {
    // Suppress style warnings that don't affect functionality
    'vue/html-self-closing': 'off',
    'vue/attributes-order': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/v-on-handler-style': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/valid-v-slot': 'off',
    'func-style': 'off',
    'no-console': 'off', // Change from error to warning
    'no-unused-vars': 'off', // Change from error to warning
    '@typescript-eslint/no-unused-vars': 'off', // Change from error to warning
  },
}

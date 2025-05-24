module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/essential',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'vue'],
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn'],
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        'max-attributes-per-line': 'off',
      },
    },
  ],
};

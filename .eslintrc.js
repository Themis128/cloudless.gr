module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    '@nuxt/eslint-config',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier',
    'plugin:vue/vue3-essential',
    'plugin:nuxt/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  plugins: [
    '@typescript-eslint',
    'import',
    'vue',
    'nuxt',
  ],
  rules: {
    // Vue specific rules
    'vue/multi-word-component-names': 'off',
    'vue/no-unused-vars': 'error',
    'vue/no-unused-components': 'error',
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/component-definition-name-casing': ['error', 'PascalCase'],
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/attribute-hyphenation': ['error', 'always'],
    'vue/v-on-event-hyphenation': ['error', 'always'],
    'vue/component-api-style': ['error', ['script-setup', 'composition']],
    'vue/component-options-name-casing': ['error', 'PascalCase'],
    'vue/custom-event-name-casing': ['error', 'camelCase'],
    'vue/define-macros-order': ['error', {
      order: ['defineProps', 'defineEmits', 'defineExpose', 'withDefaults']
    }],
    'vue/html-comment-content-spacing': ['error', 'always'],
    'vue/no-unused-properties': ['error', {
      groups: ['props', 'data', 'computed', 'methods']
    }],
    'vue/no-useless-v-bind': 'error',
    'vue/padding-line-between-blocks': ['error', 'always'],
    'vue/prefer-separate-static-class': 'error',

    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false,
    }],

    // Import rules
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type'
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    'import/no-unresolved': 'off', // Handled by TypeScript
    'import/named': 'off', // Handled by TypeScript
    'import/default': 'off', // Handled by TypeScript
    'import/no-named-as-default-member': 'off', // Handled by TypeScript
    'import/namespace': 'off', // Handled by TypeScript

    // General rules
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-unused-vars': 'off', // Use TypeScript version
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'arrow-spacing': 'error',
    'comma-dangle': ['error', 'always-multiline'],
    'semi': ['error', 'never'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'indent': ['error', 2],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
    'space-before-function-paren': ['error', 'always'],
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-spacing': 'error',
    'key-spacing': 'error',
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'max-len': ['error', {
      code: 100,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    }],

    // Nuxt specific rules
    'nuxt/no-env-in-hooks': 'error',
    'nuxt/no-globals-in-created': 'error',
    'nuxt/no-this-in-fetch-data': 'error',
    'nuxt/no-timing-in-fetch-data': 'error',
    'nuxt/require-func-head': 'error',
    'nuxt/require-render-return': 'error',
    'nuxt/require-typed-refs': 'error',
    'nuxt/require-typed-reactive-props': 'error',
    'nuxt/require-typed-slots': 'error',
    'nuxt/require-valid-file-name': 'error',
    'nuxt/use-env-composable': 'error',
    'nuxt/use-pages': 'error',
    'nuxt/use-router-within-pages': 'error',
    'nuxt/valid-define-props': 'error',
    'nuxt/valid-define-slots': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
      },
    },
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        'indent': 'off', // Let Prettier handle Vue template indentation
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off', // TypeScript handles this
      },
    },
  ],
}

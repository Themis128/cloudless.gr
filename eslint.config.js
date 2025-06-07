import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default [
  // Global ignores - applies to all configurations
  {
    ignores: [
      '**/node_modules/**',
      '**/.output/**', 
      '**/dist/**', 
      '**/.nuxt/**', 
      '**/.nitro/**',
      '**/coverage/**',
      '**/public/**',
      '**/*.md',
      '**/test-results/**',
      '**/shared_venv/**',
      '**/__pycache__/**',
      '**/*.log',
      '**/*.min.js',
      '**/*.map'
    ]
  },
  
  // TypeScript and JavaScript files
  {
    files: ['**/*.{js,ts,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: null, // Disable type-aware linting for performance
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      // Basic TypeScript rules (manually specified for compatibility)
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true 
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': ['error', { 
        allowInterfaces: 'always',
        allowObjectTypes: 'always'
      }],
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'no-unused-vars': 'off', // Turn off base rule as it conflicts with @typescript-eslint version
    },
  },
  
  // Vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        project: null, // Disable type-aware linting for performance
      },
    },
    plugins: {
      vue,
      '@typescript-eslint': ts,
    },
    rules: {
      // Vue 3 rules (manually specified for compatibility)
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      
      // TypeScript rules for Vue files
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true 
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
    },
  },
]

import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  projects: [
    // Main Nuxt app tests
    {
      plugins: [vue()],
      test: {
        globals: true,
        environment: 'happy-dom',
        include: [
          'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'components/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'composables/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'pages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'server/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'utils/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/supabase-repo/**',
          '**/supabase-project/**',
          '**/.nuxt/**',
          '**/.output/**',
        ],
      },
      root: process.cwd(),
    },
    // Supabase repo: ui-patterns
    {
      test: {
        environment: 'jsdom',
        setupFiles: ['./supabase-repo/packages/ui-patterns/vitest.setup.ts'],
        reporters: ['default', 'json'],
        coverage: {
          reporter: ['text', 'json', 'html'],
        },
      },
      root: path.resolve(__dirname, 'supabase-repo/packages/ui-patterns'),
    },
    // Supabase repo: ui
    {
      test: {
        environment: 'jsdom',
        setupFiles: ['./supabase-repo/packages/ui/vitest.setup.ts'],
        reporters: [['default']],
        coverage: {
          reporter: ['lcov'],
          exclude: ['**/*.test.ts', '**/*.test.tsx'],
          include: ['src/**/*.ts', 'src/**/*.tsx'],
        },
      },
      root: path.resolve(__dirname, 'supabase-repo/packages/ui'),
    },
    // Supabase repo: ai-commands
    {
      test: {
        environment: 'node',
        testTimeout: 30000,
        setupFiles: ['./supabase-repo/packages/ai-commands/vitest.setup.ts'],
      },
      root: path.resolve(__dirname, 'supabase-repo/packages/ai-commands'),
    },
    // Supabase repo: studio
    {
      plugins: [],
      test: {
        globals: true,
        environment: 'jsdom',
        include: [path.resolve(__dirname, 'supabase-repo/apps/studio/**/*.test.{ts,tsx}')],
        restoreMocks: true,
        setupFiles: [
          path.resolve(__dirname, 'supabase-repo/apps/studio/tests/vitestSetup.ts'),
          path.resolve(__dirname, 'supabase-repo/apps/studio/tests/setup/polyfills.js'),
          path.resolve(__dirname, 'supabase-repo/apps/studio/tests/setup/radix.js'),
        ],
        reporters: [['default']],
        coverage: {
          reporter: ['lcov'],
          exclude: ['**/*.test.ts', '**/*.test.tsx', 'lib/common/fetch/**'],
          include: ['lib/**/*.ts'],
        },
      },
      root: path.resolve(__dirname, 'supabase-repo/apps/studio'),
    },
    // Supabase repo: docs
    {
      test: {
        exclude: ['examples/**/*', '**/node_modules/**'],
        setupFiles: ['vitest.setup.ts'],
      },
      root: path.resolve(__dirname, 'supabase-repo/apps/docs'),
    },
  ],
});

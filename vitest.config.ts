import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [
      'e2e/global-setup.ts',
      path.resolve(__dirname, './__tests__/test-setup.ts')
    ],
    teardownFiles: ['e2e/global-teardown.ts'],
    testDir: './__tests__',
    timeout: 10000,
    reporter: [
      ['line'],
      ['html', { open: 'never' }],
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    },
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    moduleNameMapper: {
      '^@/(.*)$': path.resolve(__dirname, 'src/$1'),
    },
  },
});
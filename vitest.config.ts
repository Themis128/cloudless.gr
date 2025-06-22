import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/*'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})

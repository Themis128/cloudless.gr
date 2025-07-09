// Nuxt config placeholder
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  nitro: {
    // No logger property; removed invalid config
  },
  vite: {
    logLevel: 'info',
    server: {
      // Vite logs
      logLevel: 'info'
    }
  },
  imports: {
    dirs: [
      'composables',
      'stores',
      'components',
    ]
  }
});

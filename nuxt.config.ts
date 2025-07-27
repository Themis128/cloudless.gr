// Minimal configuration to isolate issues
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
  ],

  devtools: {
    enabled: false,
  },

  css: [
    '@/assets/css/main.css',
  ],

  app: {
    head: {
      title: 'Cloudless App',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
});

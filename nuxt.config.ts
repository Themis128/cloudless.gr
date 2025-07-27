// Minimal configuration to isolate issues
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-28',

  // Only the most essential modules
  modules: ['@pinia/nuxt'],

  // Only essential Vuetify plugin
  plugins: ['~/plugins/vuetify.client.ts'],

  // Disable all non-essential features
  devtools: false,
  telemetry: false,

  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: false,
    asyncContext: false,
    crossOriginPrefetch: false,
  },

  css: ['@/assets/css/main.css'],

  app: {
    head: {
      title: 'Cloudless App',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})

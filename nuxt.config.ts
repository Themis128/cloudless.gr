// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2024-07-28',
  
  // Essential modules only
  modules: [
    '@pinia/nuxt'
  ],

  // Global CSS
  css: [
    '@/assets/css/main.css'
  ],

  // Build configuration for Vuetify
  build: {
    transpile: ['vuetify']
  },

  // Vite configuration to handle Vuetify CSS imports
  vite: {
    define: {
      'process.env.DEBUG': false,
    },
    ssr: {
      noExternal: ['vuetify']
    }
  },

  // App configuration
  app: {
    head: {
      title: 'Cloudless.gr',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  // Server-side rendering
  ssr: true,

  // Development configuration
  devtools: { enabled: true },
  
  // TypeScript configuration
  typescript: {
    typeCheck: false
  },

  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: false
  }
})

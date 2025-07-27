// https://nuxt.com/docs/api/configuration/nuxt-config
import { createVuetify } from 'vuetify'
import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@pinia/nuxt',
    'nuxt-llms',
  ],
  experimental: {
    headNext: true,
  },

  // Nitro configuration
  nitro: {
    // Adding the recommended compatibility date
    compatibilityDate: '2025-07-22',
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
  },

  // Vuetify configuration via Vite plugin
  vite: {
    plugins: [
      vuetify({
        autoImport: true,
      }),
    ],
    server: {
      fs: {
        strict: false,
      },
    },
    ssr: {
      noExternal: ['vuetify'],
    },
  },

  // Build configuration for Vuetify
  build: {
    transpile: ['vuetify'],
  },

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  css: [
    'vuetify/lib/styles/main.sass',
    '@mdi/font/css/materialdesignicons.css',
    '@/assets/css/main.css',
    '@/assets/css/admin.css',
  ],

  app: {
    head: {
      title: 'Cloudless App',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A modern app built with Nuxt 3.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
        },
      ],
    },
  },

  llms: {
    domain: 'http://localhost:3000',
  },
});

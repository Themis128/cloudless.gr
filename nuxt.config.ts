// Nuxt config - Optimized for Development
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@pinia/nuxt',
    'nuxt-llms',
    '@nuxtjs/tailwindcss', // ✅ Tailwind CSS module
  ],
  experimental: {
    headNext: true,
  },

  // Nitro configuration
  nitro: {
    // Adding the recommended compatibility date
    compatibilityDate: '2025-05-21',
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
  },

  // Tailwind CSS configuration
  tailwindcss: {
    configPath: '~/tailwind.config.js',
    exposeConfig: true,
    viewer: true,
  } as any, // Fix: Cast to 'any' to bypass Nuxt config type error

  // Ensure static assets are properly served
  vite: {
    server: {
      fs: {
        strict: false,
      },
    },
  },

  // PostCSS configuration
  postcss: {
    plugins: {
      'tailwindcss/nesting': {},
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  css: [
    '@/assets/css/main.css', // ✅ Should include Tailwind directives
    '@/assets/css/admin.css', // Admin styles
  ],

  app: {
    head: {
      title: 'Cloudless',
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
})

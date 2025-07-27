// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@pinia/nuxt',
    'nuxt-llms',
    'vuetify-nuxt-module', // Using Vuetify3 instead of Tailwind
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

  // Vuetify configuration will be handled by the module

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
    '@/assets/css/main.css', // Main styles (without Tailwind)
    '@/assets/css/admin.css', // Admin styles
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

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-08',
    modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@nuxt/content',
    '@pinia/nuxt',
    'nuxt-llms',
    '@nuxtjs/supabase', // ✅ Supabase module
  ],

  experimental: {
    headNext: true,
  },

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },  },

  // CSS files to be included globally
  css: [
    '@mdi/font/css/materialdesignicons.css',
    'vuetify/styles',
    '@/assets/css/main.css'
  ],
  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/']
    }
  },

  // Ensure static assets are properly served
  vite: {
    server: {
      fs: {
        strict: false,
      },
    },
    // Vuetify CSS file transpilation fix
    ssr: {
      noExternal: ['vuetify'],
    },
  },

  build: {
    transpile: ['vuetify'],
  },

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

  content: {
    // @ts-ignore: enable content debug panel
    debug: true,
    documentDriven: true,
    highlight: {
      theme: 'github-dark',
    },
  },

  nitro: {
    compatibilityDate: '2025-05-13',
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
  },

  llms: {
    domain: 'http://localhost:3000',
  },

  // Runtime configuration for server-side environment variables
  runtimeConfig: {
    // Private keys (only available on server-side)
    jwtSecret: process.env.JWT_SECRET,
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    
    // Public keys (exposed to client-side)
    public: {
      // Public configuration here
    }
  },
});

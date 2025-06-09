// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-25',
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@nuxt/content',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    'nuxt-llms',
  ],
  css: ['@mdi/font/css/materialdesignicons.css', 'vuetify/styles', '@/assets/css/main.css'], // Runtime config
  runtimeConfig: {
    // Server-side config
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID,
    stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID,
    stripBusinessPriceId: process.env.STRIPE_BUSINESS_PRICE_ID,

    public: {
      // Supabase
      supabase: {
        url: process.env.NUXT_PUBLIC_SUPABASE_URL,
        key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      // Auth0
      auth0: {
        domain: process.env.NUXT_AUTH0_DOMAIN,
        clientId: process.env.NUXT_AUTH0_CLIENT_ID,
        audience: process.env.NUXT_AUTH0_AUDIENCE,
      },
      // Stripe public key
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
  }, // Supabase configuration
  supabase: {
    // Map environment variables to Supabase module options
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,

    // Auth configuration
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/'], // Public routes that don't require auth
    },

    // Cookie configuration
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },

  experimental: {
    headNext: true,
  },

  // Nitro configuration
  nitro: {
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
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

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
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
      routes: ['/', '/about', '/contact'],
    },
  },

  llms: {
    domain: 'http://localhost:3000',
  },
});

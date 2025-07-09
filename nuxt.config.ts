// Nuxt config placeholder
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/supabase'
  ],
  runtimeConfig: {
    public: {
      supabase: {
        url: process.env.NUXT_PUBLIC_SUPABASE_URL,
        key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    }
  },
  vite: {
    logLevel: 'info',
    server: {
      // Vite server options can be set here
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
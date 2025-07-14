// Nuxt config placeholder
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt'
  ],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  },
  vite: {
    logLevel: 'info',
  },
  nitro: {
    compatibilityDate: '2025-07-09',
  },
  imports: {
    dirs: [
      'composables',
      'stores',
      'components',
    ]
  }
});
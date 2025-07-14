// Nuxt config placeholder
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxt/image'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  },
  vite: {
    logLevel: 'info',
    ssr: {
      noExternal: ['vue-echarts', 'echarts']
    }
  },
  // To set host and port, use environment variables NUXT_HOST and NUXT_PORT or pass them via CLI
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
  ,
  app: {
    head: {
      title: 'Cloudless',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
});
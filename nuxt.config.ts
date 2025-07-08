// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.min.css',
    '@fortawesome/fontawesome-svg-core/styles.css',
  ],
  build: {
    transpile: ['vuetify'],
  },
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },
  modules: [
    '@pinia/nuxt',
    [
      '@nuxtjs/supabase',
      {
        url: process.env.SUPABASE_URL!,
        key: process.env.SUPABASE_ANON_KEY!,
        redirectOptions: {},
      }
    ]
  ],
  runtimeConfig: {
    ollamaHost: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2:latest',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
      devMode: process.env.NODE_ENV === 'development',
      baseUrl: 'http://192.168.0.23:3000'  // 👈 You can access this via `useRuntimeConfig().public.baseUrl`
    }
  },
  // Server host and port for production should be set via environment variables:
  //   NITRO_HOST=0.0.0.0 NITRO_PORT=3000 npm run start
  // For development, Vite dev server config above is sufficient.
  vite: {
    server: {
      strictPort: true,
      hmr: {
        host: '192.168.0.23',
        clientPort: 3000,
      },
      origin: 'http://192.168.0.23:3000',
    }
  },
  nitro: {
    experimental: {
      wasm: true
    },
    timing: true,
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    }
  },
  imports: {
    dirs: ['utils/**', 'composables/**', 'stores/**'],
  }
})

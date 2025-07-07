import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  ssr: false, // Optional: Use SSR if you need it
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  devServer: {
    host: '192.168.0.23',
    port: 3000
  },
  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.min.css',
    '@fortawesome/fontawesome-svg-core/styles.css',
  ],
  build: {
    transpile: ['vuetify'],
  },
  modules: [
    [
      '@nuxtjs/supabase',
      {
        url: process.env.SUPABASE_URL ?? 'http://192.168.0.23:54321',
        key:
          process.env.SUPABASE_ANON_KEY ??
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        redirectOptions: {
          login: '/auth',
          callback: '/auth/callback',
          exclude: ['/', '/info', '/info/*', '/auth', '/auth/*', '/mcp-demo'],
        },
      }
    ],
    '@pinia/nuxt'
  ],
  runtimeConfig: {
    // Private keys (only available on server-side)
    ollamaHost: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2:latest',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9zZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'http://192.168.0.23:54321',
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9zZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      devMode: process.env.NODE_ENV === 'development'
    }
  },
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
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*', // More permissive for development
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      },
      '/api/(.*)': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000 http://192.168.0.23:3000',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      },
      '/*': {
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000 http://192.168.0.23:3000',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    },
    // Increase timeout for API routes
    timing: true
  },
  imports: {
    dirs: ['utils/**', 'composables/**', 'stores/**']
  }
});

// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config';

// Type assertion for process global in Nuxt config
declare const process: {
  env: {
    [key: string]: string | undefined;
    NODE_ENV?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  };
};

export default defineNuxtConfig({
  ssr: false, // Optional: Use SSR if you need it
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.min.css',
    '@fortawesome/fontawesome-svg-core/styles.css',
  ],
  build: {
    transpile: ['vuetify'],
  },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt'],
  supabase: {
    url: process.env.SUPABASE_URL ?? 'http://127.0.0.1:8000',
    key:
      process.env.SUPABASE_ANON_KEY ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    redirectOptions: {
      login: '/auth',
      callback: '/auth/callback',
      exclude: ['/', '/info', '/info/*', '/auth', '/auth/*'],
    },
  },  runtimeConfig: {
    // Private keys (only available on server-side)
    ollamaHost: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2:latest',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    public: {
      supabaseUrl: process.env.SUPABASE_URL ?? 'http://127.0.0.1:8000',
      supabaseAnonKey:
        process.env.SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      devMode: process.env.NODE_ENV === 'development',
    },
  },  vite: {
    define: {
      'process.env.DEBUG': false,
    },
  },  nitro: {
    experimental: {
      wasm: true
    },
    routeRules: {
      '/api/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    },
    // Increase timeout for API routes
    timing: true
  },
  imports: {
    dirs: ['utils/**', 'composables/**', 'stores/**'],
  },
});

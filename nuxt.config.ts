// Nuxt config - Optimized for Development
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxt/image'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
  vite: {
    logLevel: 'warn',
    ssr: {
      noExternal: ['vue-echarts', 'echarts', 'vuetify'],
    },
    // Development optimizations
    optimizeDeps: {
      include: ['vue', 'vue-router', '@vue/runtime-core'],
    },
    // Faster builds in development
    build: {
      target: 'esnext',
      minify: false,
      sourcemap: true,
    },
    // Optimized file watching
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  },
  // To set host and port, use environment variables NUXT_HOST and NUXT_PORT or pass them via CLI
  nitro: {
    compatibilityDate: '2025-07-21',
    logLevel: 'warn', // Reduce log level to minimize timer conflicts
    experimental: {
      wasm: true,
    },
    preset: 'node',
    timing: false, // Disable timing to reduce timer conflicts
    // Faster development builds
    minify: false,
    sourceMap: true,
  },
  devServer: {
    host: '0.0.0.0', // Bind to all interfaces in container
    port: parseInt(process.env.NUXT_PORT || '3000'),
  },
  imports: {
    dirs: ['composables', 'stores', 'components'],
  },
  build: {
    transpile: ['vuetify'],
    // Development optimizations
    analyze: false,
  },
  css: ['@mdi/font/css/materialdesignicons.css', 'vuetify/styles', '~/assets/global-cards.css', '~/assets/gradient-utils.css'],
  app: {
    head: {
      title: 'Cloudless',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
    // Custom error page configuration
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  experimental: {
    payloadExtraction: false,
  },
  // Disable devtools timing features that can cause conflicts
  devtools: {
    enabled: false, // Disable devtools to prevent timer conflicts
  },
  routeRules: {
    '/': { prerender: process.env.NUXT_PRERENDER !== 'false' },
    '/models/**': { prerender: false },
    '/bots/**': { prerender: false },
    '/pipelines/**': { prerender: false },
  },
  // Development-specific optimizations
  typescript: {
    strict: false, // Faster compilation in development
    typeCheck: false, // Disable type checking for faster builds
  },
  // Optimized file watching
  watchers: {
    webpack: {
      aggregateTimeout: 300,
    },
    chokidar: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.nuxt/**', '**/.output/**', '**/dist/**'],
    },
  },
})

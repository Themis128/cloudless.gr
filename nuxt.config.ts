// Ultra-minimal configuration for fastest possible startup
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  // Only the most essential modules
  modules: ['@pinia/nuxt'],

  // Only essential Vuetify plugin
  plugins: ['~/plugins/vuetify.ts'],

  // Disable all non-essential features
  devtools: false,
  telemetry: false,

  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    inlineSSRStyles: false,
    renderJsonPayloads: false,
    asyncContext: false,
    crossOriginPrefetch: false,
  },

  // Build optimizations
  build: {
    transpile: ['vuetify'],
  },

  // Vite optimizations for faster Vuetify loading
  vite: {
    optimizeDeps: {
      include: [
        'vuetify',
        'vuetify/components',
        'vuetify/directives',
        'vuetify/styles',
        '@mdi/font',
      ],
      exclude: ['vue-demi'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vuetify: ['vuetify'],
            vendor: ['vue', 'vue-router'],
          },
        },
      },
    },
    // Optimize Vuetify loading
    ssr: {
      noExternal: ['vuetify'],
    },
    // Reduce placeholder loading time
    server: {
      hmr: {
        port: 24678,
        host: '0.0.0.0',
      },
    },
  },

  // Minimal runtime config
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL,
    },
  },

  // Disable auto-imports for faster startup
  imports: {
    autoImport: false,
  },

  // Disable components auto-import
  components: false,

  // Minimal app config
  app: {
    head: {
      title: 'Cloudless.gr',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  // Optimize loading performance
  loading: {
    color: '#667eea',
    height: '3px',
    continuous: true,
  },
})

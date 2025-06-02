import { defineNuxtConfig } from 'nuxt/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineNuxtConfig({
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes',
      meta: [
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'msapplication-tap-highlight', content: 'no' },
        { name: 'theme-color', content: '#1976d2' },
        { name: 'apple-mobile-web-app-title', content: 'Cloudless' },
      ],
      link: [
        {
          rel: 'preload',
          href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
          as: 'style',
        },
      ],
    },
  },

  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@nuxt/content',
    '@pinia/nuxt',
    '@nuxtjs/supabase'
  ],

  runtimeConfig: {
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    jwtSecret: process.env.NUXT_JWT_SECRET,
    public: {
      auth0: {
        domain: process.env.NUXT_AUTH0_DOMAIN || '',
        clientId: process.env.NUXT_AUTH0_CLIENT_ID || '',
        audience: process.env.NUXT_AUTH0_AUDIENCE || '',
      },
      publicUrl: process.env.NUXT_PUBLIC_URL || 'http://localhost:3000',
      adminEmail: process.env.ADMIN_EMAIL || 'admin@cloudless.gr',
      supabase: {
        url: process.env.NUXT_SUPABASE_URL,
        anonKey: process.env.NUXT_SUPABASE_ANON_KEY,
      },
    },
  },

  css: [
    '@mdi/font/css/materialdesignicons.css',
    'vuetify/styles',
    '@/assets/css/main.css',
    '@/assets/css/mobile-optimized.css',
  ],

  nitro: {
    prerender: {
      routes: ['/login'],
    },
    rollupConfig: {
      external: ['fsevents', 'sharp'],
    },
    experimental: {
      wasm: true,
    },
    minify: true,
    compressPublicAssets: true,
  },

  vite: {
    plugins: [tsconfigPaths()],
    server: {
      fs: {
        strict: false,
      },
    },
    ssr: {
      noExternal: ['vuetify'],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (id.includes('vue') && !id.includes('vuetify')) return 'vendor-vue-core'
              if (id.includes('vuetify')) return 'vendor-vuetify'
              if (id.includes('@supabase/')) return 'vendor-supabase'
              if (id.includes('@vueuse/')) return 'vendor-vueuse'
              if (id.includes('three') || id.includes('vanta')) return 'vendor-3d'
              if (id.includes('@mdi/') && id.includes('.js')) return 'vendor-icons'
              if (id.includes('@nuxt/') || id.includes('nuxt')) return 'vendor-nuxt'
              if (id.includes('pinia') || id.includes('jsonwebtoken')) return 'vendor-misc'
              return 'vendor-other'
            }

            if (id.includes('/components/')) {
              if (id.includes('/Layout/')) return 'app-components-layout'
              if (id.includes('/Admin/')) return 'app-components-admin'
              return 'app-components-common'
            }

            if (id.includes('/pages/')) {
              if (id.includes('/auth/')) return 'app-pages-auth'
              if (id.includes('/dashboard/')) return 'app-pages-dashboard'
              if (id.includes('/admin/')) return 'app-pages-admin'
              return 'app-pages-common'
            }

            if (id.includes('/composables/')) return 'app-composables'
            if (id.includes('/middleware/')) return 'app-middleware'
            if (id.includes('/server/')) return 'app-server'
          },
        },
      },
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', '@vueuse/core', '@supabase/supabase-js'],
      exclude: ['three', 'vanta'],
    },
  },

  build: {
    transpile: ['vuetify'],
  },

  postcss: {
    plugins: {
      autoprefixer: {},
    },
  },

  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  test: true,

  routeRules: {
    '/': { redirect: '/auth/login' },
    '/login': { redirect: '/auth/login' },
  },
})

import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineNuxtConfig({
  devServer: {
    port: 3000
  },

  // Windows path handling
  experimental: {
    scanPageMeta: true,
    typedPages: false
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
    {
      path: '~/components/dashboard',
      prefix: 'Dashboard',
    },
    {
      path: '~/components/builder',
      prefix: 'Builder',
    },
    {
      path: '~/components/Agents',
      prefix: 'Agent',
    },
    {
      path: '~/components/Admin',
      prefix: 'Admin',
    },
    {
      path: '~/components/Layout',
      prefix: 'Layout',
    },
    {
      path: '~/components/Ui',
      prefix: 'Ui',
    },
    {
      path: '~/components/demo',
      prefix: 'Demo',
    }
  ],
  
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
  },  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@nuxt/content',
    '@pinia/nuxt',
    '@nuxtjs/supabase'
  ],
  supabase: {
    redirectOptions: {
      login: '/auth/callback',
      callback: '/dashboard',
      exclude: [
        '/auth/login',
        '/auth/signup',
        '/',
        '/about',
        '/contact'
      ]
    },
    url: process.env.SUPABASE_URL,    key: process.env.SUPABASE_KEY,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  },
  runtimeConfig: {
    // Private keys
    supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    
    // MinIO configuration
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    
    public: {
      supabase: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_KEY
      }
    }
  },
  css: [
    '@mdi/font/css/materialdesignicons.css',
    'vuetify/styles',
    '~/assets/css/main.css',
    '~/assets/css/mobile-optimized.css',
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
    plugins: [
      tsconfigPaths({
        loose: true,
        root: process.cwd(),
        projects: ['./tsconfig.json']
      })
    ],
    server: {
      fs: {
        strict: false,
      },
      watch: {
        usePolling: process.platform === 'win32'
      }
    },
    ssr: {
      noExternal: ['vuetify'],
    },    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./', import.meta.url)),
        '~': fileURLToPath(new URL('./', import.meta.url)),
        '~~': fileURLToPath(new URL('./', import.meta.url)),
        '@@': fileURLToPath(new URL('./', import.meta.url))
      }
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {        output: {
          manualChunks: (id: string) => {
            // Normalize the path to use forward slashes
            const normalizedId = id.replace(/\\/g, '/');
            
            if (normalizedId.includes('node_modules')) {
              if (normalizedId.includes('vue') && !normalizedId.includes('vuetify')) return 'vendor-vue-core'
              if (normalizedId.includes('vuetify')) return 'vendor-vuetify'
              if (normalizedId.includes('@supabase/')) return 'vendor-supabase'
              if (normalizedId.includes('@vueuse/')) return 'vendor-vueuse'
              if (normalizedId.includes('three') || normalizedId.includes('vanta')) return 'vendor-3d'
              if (normalizedId.includes('@mdi/') && normalizedId.includes('.js')) return 'vendor-icons'
              if (normalizedId.includes('@nuxt/') || normalizedId.includes('nuxt')) return 'vendor-nuxt'
              if (normalizedId.includes('pinia') || normalizedId.includes('jsonwebtoken')) return 'vendor-misc'
              return 'vendor-other'
            }

            if (normalizedId.includes('/components/')) {
              if (normalizedId.includes('/Layout/')) return 'app-components-layout'
              if (normalizedId.includes('/Admin/')) return 'app-components-admin'
              return 'app-components-common'
            }

            if (normalizedId.includes('/pages/')) {
              if (normalizedId.includes('/auth/')) return 'app-pages-auth'
              if (normalizedId.includes('/dashboard/')) return 'app-pages-dashboard'
              if (normalizedId.includes('/admin/')) return 'app-pages-admin'
              return 'app-pages-common'
            }

            if (normalizedId.includes('/composables/')) return 'app-composables'
            if (normalizedId.includes('/middleware/')) return 'app-middleware'
            if (normalizedId.includes('/server/')) return 'app-server'
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

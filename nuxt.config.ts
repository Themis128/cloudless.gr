<<<<<<< HEAD
// Nuxt config - Optimized for Development
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  // Runtime config for environment variables
  runtimeConfig: {
    botApiKey: process.env.BOT_API_KEY,
    pipelineApiUrl: process.env.PIPELINE_API_URL || 'http://localhost:3002',
    pipelineTimeout: process.env.PIPELINE_TIMEOUT || 30000,
    redisUrl: process.env.REDIS_URL,
    public: {
      llmsDomain: 'http://localhost:3001',
      maxBotsPerUser: 10,
      maxPipelinesPerUser: 50,
      botFeatures: {
        enableAnalytics: true,
        enableExport: true,
        enableOfflineMode: true
      },
      pipelineFeatures: {
        enableRealTimeUpdates: true,
        enableExecutionHistory: true,
        enablePerformanceMetrics: true,
        maxExecutionTime: 300, // 5 minutes
        maxStepsPerPipeline: 20
      }
    },
  },

  // Module configurations
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image',
    '@nuxt/content',
    '@pinia/nuxt',
    ['nuxt-llms', {
      domain: 'http://localhost:3001'
    }],
    '@nuxtjs/tailwindcss',
  ],

  // Component auto-imports
  components: {
    dirs: [
      '~/components',
      '~/components/bots',
      '~/components/layout',
      '~/components/ui',
      '~/components/admin',
      '~/components/auth',
      '~/components/debug',
      '~/components/llms',
      '~/components/models',
      '~/components/pipelines',
      '~/components/step-guides'
    ],
    global: true
  },

  experimental: {
    headNext: true,
    // Improve hydration handling
    payloadExtraction: false,
  },

  // Nitro configuration with caching and storage
  nitro: {
    compatibilityDate: '2025-07-24',
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
    // Suppress middleware warnings
    experimental: {
      wasm: false,
    },
    // Storage configuration for caching
    storage: {
      redis: {
        driver: 'redis',
        url: process.env.REDIS_URL
      }
    },
    // Route rules for API caching
    routeRules: {
      '/api/pipelines': { 
        swr: 300, // Cache for 5 minutes
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300'
        }
      },
      '/api/pipelines/**': { 
        swr: 60, // Cache for 1 minute
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60'
        }
      }
    }
  },

  // SSR configuration for better hydration
  ssr: true,

  // Router configuration to handle .well-known paths
  router: {
    options: {
      strict: false,
    },
  },

  // Development configuration
  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  // Suppress middleware warnings
  typescript: {
    strict: false,
  },

  // Route rules to handle .well-known paths and bot pages
  routeRules: {
    '/.well-known/**': { 
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    },
    '/bots/**': {
      swr: 3600, // Cache bot pages for 1 hour
      headers: {
        'X-Robots-Tag': 'index, follow'
      }
    },
    '/bots/documentation/**': {
      prerender: true // Pre-render documentation pages
    },
    '/pipelines/**': {
      swr: 1800, // Cache pipeline pages for 30 minutes
      headers: {
        'X-Robots-Tag': 'index, follow'
      }
    },
    '/pipelines/documentation/**': {
      prerender: true // Pre-render pipeline documentation
    }
  },

  // Vite configuration
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: ''
        }
      }
    },
    resolve: {
      extensions: ['.js', '.ts', '.vue', '.json', '.css']
    },
    optimizeDeps: {
      include: [
        'vuetify', 
        'vuetify/components', 
        'vuetify/directives',
        'vue-echarts',
        'echarts'
      ]
    },
    ssr: {
      noExternal: ['vuetify', 'vue-echarts']
    },
    // Improve hydration handling
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router'],
            'nuxt-vendor': ['nuxt/app', 'nuxt/head'],
            'chart-vendor': ['vue-echarts', 'echarts']
          }
        }
      }
    }
=======
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@nuxt/image-edge',
    '@pinia/nuxt',
    'nuxt-llms',
    '@nuxtjs/tailwindcss', // ✅ Tailwind CSS module
  ],
  experimental: {
    headNext: true,
  },

  // Nitro configuration
  nitro: {
    // Adding the recommended compatibility date
    compatibilityDate: '2025-07-22',
    prerender: {
      routes: ['/', '/about', '/contact'],
    },
  },

  // Tailwind CSS configuration
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
    configPath: '~/tailwind.config.js',
  },

  // Ensure static assets are properly served
  vite: {
    server: {
      fs: {
        strict: false,
      },
    },
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  },

  // PostCSS configuration
  postcss: {
    plugins: {
      'tailwindcss/nesting': {},
      tailwindcss: {},
      autoprefixer: {},
    },
  },

<<<<<<< HEAD
  css: [
    '@/assets/css/main.css',
    '@/assets/css/admin.css',
=======
  devtools: {
    enabled: true,
    timeline: {
      enabled: true,
    },
  },

  css: [
    '@/assets/css/main.css', // ✅ Should include Tailwind directives
    '@/assets/css/admin.css', // Admin styles
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  ],

  app: {
    head: {
<<<<<<< HEAD
      title: 'Cloudless - AI Pipeline Management',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Create, manage, and execute AI processing pipelines with our comprehensive platform.' },
        { name: 'keywords', content: 'AI pipelines, data processing, automation, machine learning, workflow' },
        { property: 'og:title', content: 'Cloudless - AI Pipeline Management' },
        { property: 'og:description', content: 'Create, manage, and execute AI processing pipelines' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
=======
      title: 'Cloudless App',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A modern app built with Nuxt 3.' },
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
        },
      ],
    },
  },
<<<<<<< HEAD
})
=======

  llms: {
    domain: 'http://localhost:3000',
  },
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a

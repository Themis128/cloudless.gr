// nuxt.config.ts
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  ssr: false, // Optional: Use SSR if you need it
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  css: [
    "vuetify/styles",
    "@mdi/font/css/materialdesignicons.min.css",
    "@fortawesome/fontawesome-svg-core/styles.css"
  ],
  build: {
    transpile: ["vuetify"],
  },
  modules: ["@nuxtjs/supabase", "@pinia/nuxt"],
  supabase: {
    url: "http://127.0.0.1:8000",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    redirectOptions: {
      login: '/auth',
      callback: '/',
      exclude: ['/', '/info', '/info/*', '/auth', '/auth/*']
    }
  },
  runtimeConfig: {
    public: {
      supabaseUrl: "http://127.0.0.1:8000",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    },
  },
  vite: {
    define: {
      "process.env.DEBUG": false,
    },
  },
});

// nuxt.config.ts
import { defineNuxtConfig } from "nuxt/config";

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
    url: process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
    key: process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    redirectOptions: {
      login: '/auth',
      callback: '/auth/callback',
      exclude: ['/', '/info', '/info/*', '/auth', '/auth/*']
    }
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      devMode: process.env.NODE_ENV === 'development',
    },
  },
  vite: {
    define: {
      "process.env.DEBUG": false,
    },
  },
});

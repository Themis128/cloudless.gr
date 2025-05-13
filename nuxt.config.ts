// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxtjs/color-mode",
    "@vueuse/nuxt",
    "@nuxt/image-edge",
    "nuxt-windicss",
    "@nuxt/content",
    "@pinia/nuxt",
  ],

  experimental: {
    headNext: true,
  },

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  css: ["@/assets/css/main.css"],

  app: {
    head: {
      title: "Cloudless App",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "A modern app built with Nuxt 3." },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
        },
      ],
    },
  },

  content: {
    // @ts-ignore: enable content debug panel
    debug: true,
    documentDriven: true,
    highlight: {
      theme: "github-dark",
    },
  },

  nitro: {
    prerender: {
      routes: ["/", "/about", "/contact"],
    },
  },
});
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Configure llms module with the correct domain
  if (process.client) {
    // Set the domain for nuxt-llms
    window.__NUXT_LLMS_DOMAIN__ = config.public.llmsDomain
  }
}) 
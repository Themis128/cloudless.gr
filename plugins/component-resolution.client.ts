import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(nuxtApp => {
  if (process.client) {
    // Suppress specific "Failed to resolve component" warnings
    const originalWarn = console.warn
    console.warn = (...args) => {
      const message = args[0]
      if (
        typeof message === 'string' &&
        message.includes('Failed to resolve component') &&
        (message.includes('FeatureCard') ||
          message.includes('StatCard') ||
          message.includes('ContactMethodCard') ||
          message.includes('FAQCard') ||
          message.includes('TutorialCard') ||
          message.includes('LearningPathCard') ||
          message.includes('VideoCard'))
      ) {
        return
      }
      originalWarn.apply(console, args)
    }
  }
})

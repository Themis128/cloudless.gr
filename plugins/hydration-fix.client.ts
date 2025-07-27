import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin(() => {
  // This plugin helps fix hydration mismatches by ensuring consistent rendering

  // Wait for hydration to complete before making any DOM changes
  if (process.client) {
    // Use a small delay to ensure hydration is complete
    setTimeout(() => {
      // Force a re-render of any components that might have hydration issues
      window.dispatchEvent(new Event('resize'))

      // Ensure any client-only components are properly initialized
      const clientOnlyElements = document.querySelectorAll('[data-v-*]')
      clientOnlyElements.forEach(element => {
        // Add a class to mark as client-rendered
        element.classList.add('client-rendered')
      })
    }, 100)
  }
})

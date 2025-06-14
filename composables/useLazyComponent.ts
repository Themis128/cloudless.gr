import { defineAsyncComponent } from 'vue'

// Add your allowed components here
const lazyComponentMap: Record<string, () => Promise<any>> = {
  // Example: 'Example': () => import('@/components/Example.vue'),
  // 'Hero': () => import('@/components/sections/Hero.vue'),
  // 'ContactForm': () => import('@/components/forms/ContactForm.vue'),
}

export const useLazyComponent = (key: string) => {
  const loader = lazyComponentMap[key]
  if (!loader) {
    throw new Error(`Component "${key}" is not defined in lazyComponentMap`)
  }
  return defineAsyncComponent(loader)
}

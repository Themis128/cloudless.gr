import { defineAsyncComponent } from 'vue'

export const useLazyComponent = (path: string) =>
  defineAsyncComponent(() => import(`@/components/${path}.vue`))

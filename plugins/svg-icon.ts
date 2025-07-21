import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp: any) => {
  // Register SvgIcon component globally
  nuxtApp.vueApp.component('SvgIcon', () => import('~/components/ui/SvgIcon.vue'))
})

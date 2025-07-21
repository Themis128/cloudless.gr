import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp: any) => {
  // Register SvgIcon component globally
  // Using a simple string registration instead of dynamic import to avoid path issues
  nuxtApp.vueApp.component('SvgIcon', {
    template: '<svg><use :href="icon" /></svg>',
    props: ['icon']
  })
})

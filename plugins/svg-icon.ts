import { defineNuxtPlugin } from 'nuxt/app'
import SvgIcon from '../components/ui/SvgIcon.vue'

export default defineNuxtPlugin((nuxtApp: any) => {
  nuxtApp.vueApp.component('SvgIcon', SvgIcon)
})

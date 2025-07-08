import type { App } from 'vue'

export interface NuxtApp {
  vueApp: App
  // extend with any custom properties you're using
}
import type { RouteLocationRaw, RouteLocationNormalizedLoaded } from 'vue-router'
import type { Plugin } from '@nuxt/types'

declare module '#app' {
  export function definePageMeta(meta: Record<string, unknown>): void
  export function navigateTo(to: RouteLocationRaw, options?: { replace?: boolean }): Promise<void>
  export function useRoute(): RouteLocationNormalizedLoaded
  export function defineNuxtPlugin(plugin: Plugin): void
}

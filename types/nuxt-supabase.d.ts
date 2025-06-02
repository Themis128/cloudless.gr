// Type declarations for @nuxtjs/supabase module
declare module '@nuxt/schema' {
  interface NuxtConfig {
    supabase?: {
      url?: string
      key?: string
      redirectOptions?: {
        login?: string
        callback?: string
        exclude?: string[]
      }
      cookieOptions?: {
        maxAge?: number
        sameSite?: string
        secure?: boolean
      }
    }
  }
}

export { }

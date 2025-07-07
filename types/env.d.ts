// TypeScript global declaration for import.meta.env (Vite/Nuxt 3)
export {};
declare global {
  interface ImportMeta {
    env: Record<string, string | undefined>;
  }
}

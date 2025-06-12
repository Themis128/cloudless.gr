// Example recipe: form validation for Nuxt 3 + Vuetify
export function validateForm(fields: Record<string, any>): boolean {
  return Object.values(fields).every(v => v !== '' && v !== null && v !== undefined)
}

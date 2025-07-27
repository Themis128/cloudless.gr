import { computed } from 'vue'

// Composable that uses the Pinia store
export const useI18n = () => {
  const i18nStore = useI18nStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    currentLocale: computed(() => i18nStore.currentLocale),
    isLoading: computed(() => i18nStore.isLoading),
    error: computed(() => i18nStore.error),

    // Computed properties
    currentMessages: computed(() => i18nStore.currentMessages),
    availableLocales: computed(() => i18nStore.availableLocales),
    localeNames: computed(() => i18nStore.localeNames),

    // Methods (delegate to store)
    t: i18nStore.t,
    switchLanguage: i18nStore.switchLanguage,
    initializeLocale: i18nStore.initializeLocale,
    setLoading: i18nStore.setLoading,
    setError: i18nStore.setError,
    clearError: i18nStore.clearError,
    getLocaleName: i18nStore.getLocaleName,
    formatDate: i18nStore.formatDate,
    formatNumber: i18nStore.formatNumber,
    formatCurrency: i18nStore.formatCurrency,
  }
}

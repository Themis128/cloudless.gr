import { defineStore } from 'pinia'
import { ref } from 'vue'

interface PersistenceConfig {
  key: string
  storage?: 'localStorage' | 'sessionStorage'
  debounce?: number
  serialize?: (state: any) => string
  deserialize?: (data: string) => any
}

export const usePersistenceStore = defineStore('persistence', () => {
  const persistedStores = ref(new Map<string, PersistenceConfig>())
  const isHydrated = ref(false)

  // Register a store for persistence
  const registerStore = (storeName: string, config: PersistenceConfig) => {
    persistedStores.value.set(storeName, {
      storage: 'localStorage',
      debounce: 300,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      ...config,
    })
  }

  // Save state to storage
  const saveState = (storeName: string, state: any) => {
    const config = persistedStores.value.get(storeName)
    if (!config) return

    try {
      const storage =
        config.storage === 'sessionStorage' ? sessionStorage : localStorage
      const serialized = config.serialize!(state)
      storage.setItem(config.key, serialized)
    } catch (error) {
      console.error(`Failed to persist state for ${storeName}:`, error)
    }
  }

  // Load state from storage
  const loadState = (storeName: string) => {
    const config = persistedStores.value.get(storeName)
    if (!config) return null

    try {
      const storage =
        config.storage === 'sessionStorage' ? sessionStorage : localStorage
      const serialized = storage.getItem(config.key)
      if (serialized) {
        return config.deserialize!(serialized)
      }
    } catch (error) {
      console.error(`Failed to load state for ${storeName}:`, error)
    }
    return null
  }

  // Hydrate all registered stores
  const hydrateAll = () => {
    for (const [storeName] of persistedStores.value) {
      const state = loadState(storeName)
      if (state) {
        // Dispatch hydration event
        window.dispatchEvent(
          new CustomEvent('store-hydrate', {
            detail: { storeName, state },
          })
        )
      }
    }
    isHydrated.value = true
  }

  // Clear persisted state
  const clearPersistedState = (storeName?: string) => {
    if (storeName) {
      const config = persistedStores.value.get(storeName)
      if (config) {
        const storage =
          config.storage === 'sessionStorage' ? sessionStorage : localStorage
        storage.removeItem(config.key)
      }
    } else {
      // Clear all persisted state
      for (const [name, config] of persistedStores.value) {
        const storage =
          config.storage === 'sessionStorage' ? sessionStorage : localStorage
        storage.removeItem(config.key)
      }
    }
  }

  // Get storage usage statistics
  const getStorageStats = () => {
    const stats: any = {}

    for (const [storeName, config] of persistedStores.value) {
      const storage =
        config.storage === 'sessionStorage' ? sessionStorage : localStorage
      const data = storage.getItem(config.key)
      if (data) {
        stats[storeName] = {
          size: new Blob([data]).size,
          key: config.key,
          storage: config.storage,
        }
      }
    }

    return stats
  }

  return {
    registerStore,
    saveState,
    loadState,
    hydrateAll,
    clearPersistedState,
    getStorageStats,
    isHydrated,
  }
})

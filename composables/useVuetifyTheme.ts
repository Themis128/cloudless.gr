/**
 * Vuetify theme and UI composable
 * Vue 3 + Vuetify 3 best practices:
 * - Reactive theme management
 * - Type-safe theme configuration
 * - Performance optimization
 * - Accessibility support
 */
import { ref, computed, watch } from 'vue'
import { useTheme } from 'vuetify'
import type { ThemeDefinition } from 'vuetify'

interface VuetifyThemeConfig {
  name: string
  dark: boolean
  colors: Record<string, string>
}

interface BreakpointInfo {
  name: string
  width: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

/**
 * Enhanced Vuetify composable with Vue 3 best practices
 */
export function useVuetifyTheme() {
  // Get Vuetify theme instance
  const theme = useTheme()
  
  // Reactive state management
  const currentTheme = ref(theme.current.value.dark ? 'dark' : 'light')
  const isSystemDarkMode = ref(false)
  const userPreference = ref<'light' | 'dark' | 'system'>('system')
  
  // Custom theme definitions
  const lightTheme: ThemeDefinition = {
    dark: false,
    colors: {
      primary: '#1976D2',
      secondary: '#424242',
      accent: '#82B1FF',
      error: '#FF5252',
      info: '#2196F3',
      success: '#4CAF50',
      warning: '#FFC107',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      'on-primary': '#FFFFFF',
      'on-secondary': '#FFFFFF',
      'on-background': '#000000',
      'on-surface': '#000000',
      'on-error': '#FFFFFF'
    }
  }
  
  const darkTheme: ThemeDefinition = {
    dark: true,
    colors: {
      primary: '#2196F3',
      secondary: '#616161',
      accent: '#FF4081',
      error: '#FF5252',
      info: '#2196F3',
      success: '#4CAF50',
      warning: '#FFC107',
      background: '#121212',
      surface: '#1E1E1E',
      'on-primary': '#FFFFFF',
      'on-secondary': '#FFFFFF',
      'on-background': '#FFFFFF',
      'on-surface': '#FFFFFF',
      'on-error': '#000000'
    }
  }
  
  // Computed properties for reactive theme management
  const isDarkMode = computed(() => currentTheme.value === 'dark')
  const currentColors = computed(() => theme.current.value.colors)
  const themeConfig = computed((): VuetifyThemeConfig => ({
    name: currentTheme.value,
    dark: isDarkMode.value,
    colors: currentColors.value
  }))
  
  // Initialize system preference detection
  const initializeSystemPreference = () => {
    if (typeof window !== 'undefined') {
      // Check system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      isSystemDarkMode.value = mediaQuery.matches
      
      // Listen for system preference changes
      mediaQuery.addEventListener('change', (e) => {
        isSystemDarkMode.value = e.matches
        if (userPreference.value === 'system') {
          applyTheme(e.matches ? 'dark' : 'light')
        }
      })
    }
  }
  
  // Apply theme with transition
  const applyTheme = (themeName: 'light' | 'dark') => {
    if (currentTheme.value !== themeName) {
      currentTheme.value = themeName
      theme.global.name.value = themeName
      
      // Store preference
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('vuetify-theme', themeName)
      }
      
      // Dispatch custom event for other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('theme-changed', {
          detail: { theme: themeName, colors: currentColors.value }
        }))
      }
    }
  }
  
  // Toggle between light and dark themes
  const toggleTheme = () => {
    const newTheme = isDarkMode.value ? 'light' : 'dark'
    userPreference.value = newTheme
    applyTheme(newTheme)
  }
  
  // Set user preference
  const setThemePreference = (preference: 'light' | 'dark' | 'system') => {
    userPreference.value = preference
    
    if (preference === 'system') {
      applyTheme(isSystemDarkMode.value ? 'dark' : 'light')
    } else {
      applyTheme(preference)
    }
    
    // Store preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme-preference', preference)
    }
  }
  
  // Initialize theme from storage
  const initializeTheme = () => {
    if (typeof localStorage !== 'undefined') {
      const savedPreference = localStorage.getItem('theme-preference') as 'light' | 'dark' | 'system' | null
      const savedTheme = localStorage.getItem('vuetify-theme') as 'light' | 'dark' | null
      
      if (savedPreference) {
        userPreference.value = savedPreference
        if (savedPreference === 'system') {
          initializeSystemPreference()
          applyTheme(isSystemDarkMode.value ? 'dark' : 'light')
        } else {
          applyTheme(savedPreference)
        }
      } else if (savedTheme) {
        userPreference.value = savedTheme
        applyTheme(savedTheme)
      } else {
        // Default to system preference
        initializeSystemPreference()
        setThemePreference('system')
      }
    }
  }
  
  // Custom color utilities
  const getThemeColor = (colorName: string): string => {
    return currentColors.value[colorName] || colorName
  }
  
  const getCSSCustomProperty = (propertyName: string): string => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(`--v-theme-${propertyName}`)
        .trim()
    }
    return ''
  }
  
  // Dynamic color generation
  const generateColorVariants = (baseColor: string) => {
    const variants = {
      lighten1: lightenColor(baseColor, 0.1),
      lighten2: lightenColor(baseColor, 0.2),
      lighten3: lightenColor(baseColor, 0.3),
      darken1: darkenColor(baseColor, 0.1),
      darken2: darkenColor(baseColor, 0.2),
      darken3: darkenColor(baseColor, 0.3)
    }
    return variants
  }
  
  // Watch for theme changes to apply custom styles
  watch(currentTheme, (newTheme) => {
    if (typeof document !== 'undefined') {
      // Update document class for CSS targeting
      document.documentElement.classList.remove('theme-light', 'theme-dark')
      document.documentElement.classList.add(`theme-${newTheme}`)
      
      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', getThemeColor('primary'))
      }
    }
  })
  
  return {
    // State
    currentTheme: readonly(currentTheme),
    userPreference: readonly(userPreference),
    isSystemDarkMode: readonly(isSystemDarkMode),
    
    // Computed
    isDarkMode,
    currentColors,
    themeConfig,
    
    // Methods
    toggleTheme,
    setThemePreference,
    initializeTheme,
    initializeSystemPreference,
    getThemeColor,
    getCSSCustomProperty,
    generateColorVariants,
    
    // Theme definitions
    lightTheme,
    darkTheme
  }
}

/**
 * Breakpoint management composable
 */
export function useVuetifyBreakpoints() {
  const { mobile, tablet, desktop, width, height } = useDisplay()
  
  const breakpointInfo = computed((): BreakpointInfo => {
    let name = 'xs'
    if (width.value >= 1920) name = 'xl'
    else if (width.value >= 1264) name = 'lg'
    else if (width.value >= 960) name = 'md'
    else if (width.value >= 600) name = 'sm'
    
    return {
      name,
      width: width.value,
      isMobile: mobile.value,
      isTablet: tablet.value,
      isDesktop: desktop.value
    }
  })
  
  const isMobileOrTablet = computed(() => mobile.value || tablet.value)
  const isLargeScreen = computed(() => width.value >= 1264)
  
  return {
    mobile,
    tablet,
    desktop,
    width,
    height,
    breakpointInfo,
    isMobileOrTablet,
    isLargeScreen
  }
}

/**
 * Enhanced snackbar management
 */
export function useVuetifySnackbar() {
  const snackbars = ref<Array<{
    id: string
    message: string
    color?: string
    timeout?: number
    action?: { text: string; handler: () => void }
    persistent?: boolean
  }>>([])
  
  const showSnackbar = (
    message: string,
    options: {
      color?: string
      timeout?: number
      action?: { text: string; handler: () => void }
      persistent?: boolean
    } = {}
  ) => {
    const id = `snackbar-${Date.now()}-${Math.random()}`
    const snackbar = {
      id,
      message,
      color: options.color || 'info',
      timeout: options.timeout || 4000,
      action: options.action,
      persistent: options.persistent || false
    }
    
    snackbars.value.push(snackbar)
    
    // Auto-remove after timeout (unless persistent)
    if (!snackbar.persistent) {
      setTimeout(() => {
        removeSnackbar(id)
      }, snackbar.timeout)
    }
    
    return id
  }
  
  const removeSnackbar = (id: string) => {
    const index = snackbars.value.findIndex(s => s.id === id)
    if (index > -1) {
      snackbars.value.splice(index, 1)
    }
  }
  
  const clearAll = () => {
    snackbars.value = []
  }
  
  // Convenience methods
  const showSuccess = (message: string, options = {}) => 
    showSnackbar(message, { ...options, color: 'success' })
  
  const showError = (message: string, options = {}) => 
    showSnackbar(message, { ...options, color: 'error' })
  
  const showWarning = (message: string, options = {}) => 
    showSnackbar(message, { ...options, color: 'warning' })
  
  const showInfo = (message: string, options = {}) => 
    showSnackbar(message, { ...options, color: 'info' })
  
  return {
    snackbars: readonly(snackbars),
    showSnackbar,
    removeSnackbar,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}

// Utility functions for color manipulation
function lightenColor(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * amount * 100)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
}

function darkenColor(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * amount * 100)
  const R = (num >> 16) - amt
  const G = (num >> 8 & 0x00FF) - amt
  const B = (num & 0x0000FF) - amt
  return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
    (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
    (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1)
}

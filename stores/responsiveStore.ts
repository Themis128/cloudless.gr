import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useResponsiveStore = defineStore('responsive', () => {
  // State
  const width = ref(process.client ? window.innerWidth : 0)
  const height = ref(process.client ? window.innerHeight : 0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Breakpoints (in pixels)
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
    largeDesktop: 1920,
  }

  // Computed properties for device types
  const isMobile = computed(() => width.value < breakpoints.mobile)
  const isTablet = computed(
    () => width.value >= breakpoints.mobile && width.value < breakpoints.tablet
  )
  const isDesktop = computed(
    () => width.value >= breakpoints.tablet && width.value < breakpoints.desktop
  )
  const isLargeDesktop = computed(() => width.value >= breakpoints.desktop)

  // Computed properties for orientation
  const isPortrait = computed(() => height.value >= width.value)
  const isLandscape = computed(() => width.value > height.value)

  // Computed properties for responsive utilities
  const isSmallScreen = computed(() => width.value < breakpoints.tablet)
  const isMediumScreen = computed(
    () => width.value >= breakpoints.tablet && width.value < breakpoints.desktop
  )
  const isLargeScreen = computed(() => width.value >= breakpoints.desktop)

  // Computed properties for Vuetify breakpoints
  const isXs = computed(() => width.value < 600)
  const isSm = computed(() => width.value >= 600 && width.value < 960)
  const isMd = computed(() => width.value >= 960 && width.value < 1280)
  const isLg = computed(() => width.value >= 1280 && width.value < 1920)
  const isXl = computed(() => width.value >= 1920)

  // Computed properties for common responsive patterns
  const showSidebar = computed(() => width.value >= breakpoints.tablet)
  const showMobileMenu = computed(() => width.value < breakpoints.tablet)
  const isTouchDevice = computed(() => {
    if (!process.client) return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  })

  // Update responsive values based on current window size
  const updateResponsiveValues = () => {
    if (!process.client) return

    try {
      // Update dimensions
      width.value = window.innerWidth
      height.value = window.innerHeight
    } catch (err: any) {
      console.error('Error updating responsive values:', err)
      setError(err.message || 'Failed to update responsive values')
    }
  }

  // Check if the current width is at least the specified breakpoint
  const isMinWidth = (breakpoint: number) => {
    return width.value >= breakpoint
  }

  // Check if the current width is at most the specified breakpoint
  const isMaxWidth = (breakpoint: number) => {
    return width.value <= breakpoint
  }

  // Check if the current width is between two breakpoints
  const isBetweenWidth = (min: number, max: number) => {
    return width.value >= min && width.value <= max
  }

  // Get the current breakpoint name
  const getCurrentBreakpoint = () => {
    if (width.value < breakpoints.mobile) return 'mobile'
    if (width.value < breakpoints.tablet) return 'tablet'
    if (width.value < breakpoints.desktop) return 'desktop'
    return 'largeDesktop'
  }

  // Get the current Vuetify breakpoint
  const getVuetifyBreakpoint = () => {
    if (width.value < 600) return 'xs'
    if (width.value < 960) return 'sm'
    if (width.value < 1280) return 'md'
    if (width.value < 1920) return 'lg'
    return 'xl'
  }

  // Initialize responsive store
  const initializeResponsive = () => {
    if (process.client) {
      updateResponsiveValues() // Initial values

      // Add resize event listener
      window.addEventListener('resize', updateResponsiveValues)

      // Add orientation change listener
      window.addEventListener('orientationchange', () => {
        setTimeout(updateResponsiveValues, 100) // Small delay to ensure orientation change is complete
      })
    }
  }

  // Clean up event listeners
  const cleanupResponsive = () => {
    if (process.client) {
      window.removeEventListener('resize', updateResponsiveValues)
      window.removeEventListener('orientationchange', updateResponsiveValues)
    }
  }

  // Set loading state
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  // Set error state
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  // Get responsive class based on breakpoint
  const getResponsiveClass = (baseClass: string, breakpoint?: string) => {
    if (!breakpoint) return baseClass
    return `${baseClass}-${breakpoint}`
  }

  // Get responsive visibility classes
  const getVisibilityClasses = () => {
    return {
      'd-none': isXs.value,
      'd-sm-none': isSm.value,
      'd-md-none': isMd.value,
      'd-lg-none': isLg.value,
      'd-xl-none': isXl.value,
      'd-xs-block': !isXs.value,
      'd-sm-block': !isSm.value,
      'd-md-block': !isMd.value,
      'd-lg-block': !isLg.value,
      'd-xl-block': !isXl.value,
    }
  }

  // Get responsive spacing classes
  const getSpacingClasses = (baseSpacing: string) => {
    return {
      [baseSpacing]: true,
      [`${baseSpacing}-sm`]: isSm.value,
      [`${baseSpacing}-md`]: isMd.value,
      [`${baseSpacing}-lg`]: isLg.value,
      [`${baseSpacing}-xl`]: isXl.value,
    }
  }

  return {
    // State
    width,
    height,
    isLoading,
    error,

    // Breakpoints
    breakpoints,

    // Computed - Device types
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,

    // Computed - Orientation
    isPortrait,
    isLandscape,

    // Computed - Screen sizes
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,

    // Computed - Vuetify breakpoints
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,

    // Computed - Responsive patterns
    showSidebar,
    showMobileMenu,
    isTouchDevice,

    // Methods
    updateResponsiveValues,
    isMinWidth,
    isMaxWidth,
    isBetweenWidth,
    getCurrentBreakpoint,
    getVuetifyBreakpoint,
    initializeResponsive,
    cleanupResponsive,
    setLoading,
    setError,
    clearError,
    getResponsiveClass,
    getVisibilityClasses,
    getSpacingClasses,
  }
})

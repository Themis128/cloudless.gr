import { computed, onMounted, onUnmounted } from 'vue'

/**
 * Composable for responsive design that provides viewport dimensions and device type detection
 *
 * @returns Object with responsive design utilities
 */
export function useResponsive() {
  const responsiveStore = useResponsiveStore()

  // Initialize responsive store on mount
  onMounted(() => {
    responsiveStore.initializeResponsive()
  })

  // Clean up on unmount
  onUnmounted(() => {
    responsiveStore.cleanupResponsive()
  })

  // Return readonly state and computed properties for backward compatibility
  return {
    // Dimensions (readonly for backward compatibility)
    width: computed(() => responsiveStore.width),
    height: computed(() => responsiveStore.height),

    // Device types (readonly for backward compatibility)
    isMobile: computed(() => responsiveStore.isMobile),
    isTablet: computed(() => responsiveStore.isTablet),
    isDesktop: computed(() => responsiveStore.isDesktop),
    isLargeDesktop: computed(() => responsiveStore.isLargeDesktop),

    // Orientation (readonly for backward compatibility)
    isPortrait: computed(() => responsiveStore.isPortrait),
    isLandscape: computed(() => responsiveStore.isLandscape),

    // Breakpoints for reference
    breakpoints: responsiveStore.breakpoints,

    // Helper functions (delegate to store)
    updateResponsiveValues: responsiveStore.updateResponsiveValues,
    isMinWidth: responsiveStore.isMinWidth,
    isMaxWidth: responsiveStore.isMaxWidth,
    isBetweenWidth: responsiveStore.isBetweenWidth,
    getCurrentBreakpoint: responsiveStore.getCurrentBreakpoint,
    getVuetifyBreakpoint: responsiveStore.getVuetifyBreakpoint,

    // Additional responsive utilities from store
    isSmallScreen: computed(() => responsiveStore.isSmallScreen),
    isMediumScreen: computed(() => responsiveStore.isMediumScreen),
    isLargeScreen: computed(() => responsiveStore.isLargeScreen),
    isXs: computed(() => responsiveStore.isXs),
    isSm: computed(() => responsiveStore.isSm),
    isMd: computed(() => responsiveStore.isMd),
    isLg: computed(() => responsiveStore.isLg),
    isXl: computed(() => responsiveStore.isXl),
    showSidebar: computed(() => responsiveStore.showSidebar),
    showMobileMenu: computed(() => responsiveStore.showMobileMenu),
    isTouchDevice: computed(() => responsiveStore.isTouchDevice),
    getResponsiveClass: responsiveStore.getResponsiveClass,
    getVisibilityClasses: responsiveStore.getVisibilityClasses,
    getSpacingClasses: responsiveStore.getSpacingClasses,

    // State management
    isLoading: computed(() => responsiveStore.isLoading),
    error: computed(() => responsiveStore.error),
    setLoading: responsiveStore.setLoading,
    setError: responsiveStore.setError,
    clearError: responsiveStore.clearError,
  }
}

import { computed, onMounted, onUnmounted, ref } from '#imports';

/**
 * Enhanced composable for responsive design that provides viewport dimensions and device type detection
 * Aligned with Vuetify breakpoints for consistency
 *
 * @returns Object with responsive design utilities
 */
export function useResponsive() {
  // Screen dimensions
  const width = ref(process.client ? window.innerWidth : 0);
  const height = ref(process.client ? window.innerHeight : 0);

  // Device types based on Vuetify breakpoints
  const isMobile = ref(false);
  const isTablet = ref(false);
  const isDesktop = ref(false);
  const isLargeDesktop = ref(false);
  const isExtraLarge = ref(false);

  // Screen orientation
  const isPortrait = ref(false);
  const isLandscape = ref(false);

  // Enhanced mobile detection
  const isTouchDevice = ref(false);
  const isSmallMobile = ref(false); // For very small screens < 480px

  // Vuetify-aligned breakpoints (in pixels)
  const breakpoints = {
    xs: 0, // Extra small: 0px and up
    sm: 600, // Small: 600px and up
    md: 960, // Medium: 960px and up
    lg: 1264, // Large: 1264px and up
    xl: 1904, // Extra large: 1904px and up
  };

  // Legacy breakpoints for backward compatibility
  const legacyBreakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
  };

  /**
   * Updates all responsive values based on current window size
   */
  const updateResponsiveValues = () => {
    if (!process.client) return;

    // Update dimensions
    width.value = window.innerWidth;
    height.value = window.innerHeight;

    // Update device types using Vuetify breakpoints
    isMobile.value = width.value < breakpoints.sm; // 0-599px
    isTablet.value = width.value >= breakpoints.sm && width.value < breakpoints.md; // 600-959px
    isDesktop.value = width.value >= breakpoints.md && width.value < breakpoints.lg; // 960-1263px
    isLargeDesktop.value = width.value >= breakpoints.lg && width.value < breakpoints.xl; // 1264-1903px
    isExtraLarge.value = width.value >= breakpoints.xl; // 1904px+

    // Enhanced mobile detection
    isSmallMobile.value = width.value < 480;
    isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Update orientation
    isPortrait.value = height.value >= width.value;
    isLandscape.value = width.value > height.value;
  };

  /**
   * Check if the current width is at least the specified breakpoint
   * @param breakpoint - The minimum width to check for
   */
  const isMinWidth = (breakpoint: number) => {
    return width.value >= breakpoint;
  };

  /**
   * Check if the current width is at most the specified breakpoint
   * @param breakpoint - The maximum width to check for
   */
  const isMaxWidth = (breakpoint: number) => {
    return width.value <= breakpoint;
  };

  /**
   * Get responsive classes for Vuetify components
   */
  const getResponsiveClasses = computed(() => ({
    mobile: isMobile.value ? 'mobile-view' : '',
    tablet: isTablet.value ? 'tablet-view' : '',
    desktop: isDesktop.value ? 'desktop-view' : '',
    touch: isTouchDevice.value ? 'touch-device' : '',
    portrait: isPortrait.value ? 'portrait' : 'landscape',
  }));

  /**
   * Get responsive column props for v-col
   */
  const getResponsiveCols = (mobile = 12, tablet = 6, desktop = 4, large = 3) => ({
    cols: mobile,
    sm: tablet,
    md: desktop,
    lg: large,
  });

  /**
   * Get responsive spacing for containers
   */
  const getResponsiveSpacing = computed(() => ({
    padding: isMobile.value ? 'pa-2' : 'pa-4',
    margin: isMobile.value ? 'ma-1' : 'ma-2',
    gap: isMobile.value ? 'ga-2' : 'ga-4',
  }));

  // Set up event listener when mounted
  onMounted(() => {
    if (process.client) {
      updateResponsiveValues(); // Initial values
      window.addEventListener('resize', updateResponsiveValues);
    }
  });

  // Clean up event listener when component unmounts
  onUnmounted(() => {
    if (process.client) {
      window.removeEventListener('resize', updateResponsiveValues);
    }
  });

  return {
    // Dimensions
    width,
    height,

    // Device types
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isExtraLarge,
    isSmallMobile,
    isTouchDevice,

    // Orientation
    isPortrait,
    isLandscape,

    // Breakpoints for reference
    breakpoints,
    legacyBreakpoints,

    // Helper functions
    isMinWidth,
    isMaxWidth,
    getResponsiveClasses,
    getResponsiveCols,
    getResponsiveSpacing,
  };
}

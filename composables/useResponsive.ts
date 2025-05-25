import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable for responsive design that provides viewport dimensions and device type detection
 * 
 * @returns Object with responsive design utilities
 */
export function useResponsive() {
  // Screen dimensions
  const width = ref(process.client ? window.innerWidth : 0)
  const height = ref(process.client ? window.innerHeight : 0)
  
  // Device types based on common breakpoints
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isDesktop = ref(false)
  const isLargeDesktop = ref(false)
  
  // Screen orientation
  const isPortrait = ref(false)
  const isLandscape = ref(false)
  
  // Breakpoints (in pixels)
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1440
  }
  
  /**
   * Updates all responsive values based on current window size
   */
  const updateResponsiveValues = () => {
    if (!process.client) return
    
    // Update dimensions
    width.value = window.innerWidth
    height.value = window.innerHeight
    
    // Update device types
    isMobile.value = width.value < breakpoints.mobile
    isTablet.value = width.value >= breakpoints.mobile && width.value < breakpoints.tablet
    isDesktop.value = width.value >= breakpoints.tablet && width.value < breakpoints.desktop
    isLargeDesktop.value = width.value >= breakpoints.desktop
    
    // Update orientation
    isPortrait.value = height.value >= width.value
    isLandscape.value = width.value > height.value
  }
  
  /**
   * Check if the current width is at least the specified breakpoint
   * @param breakpoint - The minimum width to check for
   */
  const isMinWidth = (breakpoint: number) => {
    return width.value >= breakpoint
  }
  
  /**
   * Check if the current width is at most the specified breakpoint
   * @param breakpoint - The maximum width to check for
   */
  const isMaxWidth = (breakpoint: number) => {
    return width.value <= breakpoint
  }

  // Set up event listener when mounted
  onMounted(() => {
    if (process.client) {
      updateResponsiveValues() // Initial values
      window.addEventListener('resize', updateResponsiveValues)
    }
  })

  // Clean up event listener when component unmounts
  onUnmounted(() => {
    if (process.client) {
      window.removeEventListener('resize', updateResponsiveValues)
    }
  })

  return {
    // Dimensions
    width,
    height,
    
    // Device types
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    
    // Orientation
    isPortrait,
    isLandscape,
    
    // Breakpoints for reference
    breakpoints,
    
    // Helper functions
    isMinWidth,
    isMaxWidth,
  }
}
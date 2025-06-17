// Simple JavaScript test for navigation
console.log('🧪 Navigation Test Script Loaded')

// Test navigation function
function testNavigationManually() {
  console.log('Testing manual navigation...')
  
  // Check if we're on the home page
  if (window.location.pathname === '/') {
    console.log('✓ On home page')
    
    // Look for the button
    const tryItFreeBtn = document.querySelector('[aria-label="Start using Cloudless"]')
    if (tryItFreeBtn) {
      console.log('✓ Found "Try It Free" button')
      console.log('Button element:', tryItFreeBtn)
      
      // Check if button has click handler
      tryItFreeBtn.addEventListener('click', (e) => {
        console.log('🔗 Button clicked!', e)
        console.log('Navigation should happen now...')
      })
      
    } else {
      console.log('❌ "Try It Free" button not found')
      console.log('Available buttons:', document.querySelectorAll('button'))
    }
  }
  
  // Check if Vue Router is available
  if (window.$nuxt) {
    console.log('✓ Nuxt app is available')
    console.log('Router:', window.$nuxt.$router)
  } else {
    console.log('❌ Nuxt app not available')
  }
}

// Run test when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', testNavigationManually)
} else {
  testNavigationManually()
}

// Also run after a delay to catch SPA hydration
setTimeout(testNavigationManually, 2000)

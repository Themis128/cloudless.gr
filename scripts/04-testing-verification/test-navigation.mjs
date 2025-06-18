#!/usr/bin/env node

/**
 * Debug Navigation Issues
 * Test routing between index and auth pages
 */

async function testNavigation() {
  console.log('🔍 Testing Navigation Issues...\n')
  
  try {
    // Test home page
    console.log('1. Testing Home Page (/)...')
    const homeResponse = await fetch('http://localhost:3000/')
    console.log(`   Status: ${homeResponse.status}`)
    
    if (homeResponse.ok) {
      const homeContent = await homeResponse.text()
      const hasTryItFree = homeContent.includes('Try It Free')
      const hasGoToAuth = homeContent.includes('goToAuth')
      const hasToAuth = homeContent.includes('to="/auth"')
      
      console.log(`   ✓ Contains "Try It Free" button: ${hasTryItFree}`)
      console.log(`   ✓ Has goToAuth function: ${hasGoToAuth}`)
      console.log(`   ✓ Has to="/auth" prop: ${hasToAuth}`)
    }
    
    console.log('\n2. Testing Auth Page (/auth)...')
    const authResponse = await fetch('http://localhost:3000/auth')
    console.log(`   Status: ${authResponse.status}`)
    
    if (authResponse.ok) {
      const authContent = await authResponse.text()
      const hasLoginForm = authContent.includes('LoginForm')
      const hasAuthContainer = authContent.includes('auth-container')
      
      console.log(`   ✓ Contains LoginForm component: ${hasLoginForm}`)
      console.log(`   ✓ Has auth-container class: ${hasAuthContainer}`)
    }
    
    console.log('\n3. Common Navigation Issues:')
    console.log('   • Vuetify v-btn "to" prop conflicts')
    console.log('   • SPA mode client-side routing issues')
    console.log('   • Layout transition problems')
    console.log('   • JavaScript errors preventing navigation')
    
    console.log('\n4. Debugging Steps:')
    console.log('   • Open browser dev tools (F12)')
    console.log('   • Go to http://localhost:3000')
    console.log('   • Click "Try It Free" button')
    console.log('   • Check console for errors')
    console.log('   • Check if URL changes to /auth')
    console.log('   • Verify if page content changes')
    
  } catch (error) {
    console.error('❌ Error testing navigation:', error.message)
  }
}

testNavigation().catch(console.error)

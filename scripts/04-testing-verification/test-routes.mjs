#!/usr/bin/env node

/**
 * Simple Route Tester for Nuxt 3
 * Tests actual HTTP responses for all routes
 */

const testRoutes = [
  '/',
  '/auth',
  '/auth/register',
  '/auth/reset',
  '/info',
  '/info/about',
  '/info/contact',
  '/info/faq',
  '/info/sitemap',  
  '/info/matrix',
  // Note: Protected routes will redirect to auth, which is expected behavior
]

async function testRoute(route) {
  try {
    const response = await fetch(`http://localhost:3000${route}`)
    const status = response.status
    const statusText = response.statusText
    
    if (status === 200) {
      return { route, status: '✅ OK', code: status }
    } else if (status === 302 || status === 301) {
      const location = response.headers.get('location')
      return { route, status: '🔄 REDIRECT', code: status, location }
    } else if (status === 404) {
      return { route, status: '❌ NOT FOUND', code: status }
    } else {
      return { route, status: `⚠️  ${statusText}`, code: status }
    }
  } catch (error) {
    return { route, status: '🚫 ERROR', error: error.message }
  }
}

async function testAllRoutes() {
  console.log('🧪 Testing Nuxt Routes...\n')
  
  // Test if server is running
  try {
    await fetch('http://localhost:3000')
  } catch (error) {
    console.log('❌ Cannot connect to http://localhost:3000')
    console.log('   Make sure your Nuxt dev server is running with: npm run dev')
    process.exit(1)
  }
  
  const results = []
  
  for (const route of testRoutes) {
    const result = await testRoute(route)
    results.push(result)
    
    console.log(`${result.status} ${route}${result.location ? ` → ${result.location}` : ''}`)
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n📊 Summary:')
  const ok = results.filter(r => r.status.includes('OK')).length
  const redirects = results.filter(r => r.status.includes('REDIRECT')).length  
  const errors = results.filter(r => r.status.includes('ERROR') || r.status.includes('NOT FOUND')).length
  
  console.log(`   ✅ Working: ${ok}`)
  console.log(`   🔄 Redirects: ${redirects}`)
  console.log(`   ❌ Errors: ${errors}`)
  
  if (errors === 0) {
    console.log('\n🎉 All tested routes are working!')
  } else {
    console.log(`\n⚠️  Found ${errors} routing issues that need attention.`)
  }
}

testAllRoutes().catch(console.error)

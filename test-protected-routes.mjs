#!/usr/bin/env node

/**
 * Test Protected Routes - Should redirect to auth
 */

const protectedRoutes = [
  '/users',
  '/users/profile',
  '/projects',
  '/projects/create',
  '/storage',
  '/settings',
  '/admin',
  '/admin/dashboard'
]

async function testProtectedRoute(route) {
  try {
    const response = await fetch(`http://localhost:3000${route}`, {
      redirect: 'manual' // Don't follow redirects automatically
    })
    
    const status = response.status
    
    if (status === 302 || status === 301) {
      const location = response.headers.get('location')
      const isAuthRedirect = location && (location.includes('/auth') || location.includes('/login'))
      
      if (isAuthRedirect) {
        return { route, status: '✅ PROTECTED', message: `Redirects to ${location}` }
      } else {
        return { route, status: '⚠️  UNEXPECTED', message: `Redirects to ${location}` }
      }
    } else if (status === 200) {
      return { route, status: '❌ UNPROTECTED', message: 'Should require authentication' }
    } else {
      return { route, status: '❌ ERROR', message: `HTTP ${status}` }
    }
  } catch (error) {
    return { route, status: '🚫 FAILED', message: error.message }
  }
}

async function testProtectedRoutes() {
  console.log('🔒 Testing Protected Routes...\n')
  
  const results = []
  
  for (const route of protectedRoutes) {
    const result = await testProtectedRoute(route)
    results.push(result)
    
    console.log(`${result.status} ${route} - ${result.message}`)
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
    console.log('\n📊 Protected Routes Summary:')
  const properlyProtected = results.filter(r => r.status.includes('PROTECTED')).length
  const unprotected = results.filter(r => r.status.includes('UNPROTECTED')).length
  const errors = results.filter(r => r.status.includes('ERROR') || r.status.includes('FAILED')).length
  
  console.log(`   🔒 Properly Protected: ${properlyProtected}`)
  console.log(`   ❌ Unprotected (Security Risk): ${unprotected}`)
  console.log(`   🚫 Errors: ${errors}`)
  
  if (unprotected === 0 && errors === 0) {
    console.log('\n🎉 All protected routes are properly secured!')
  } else {
    console.log(`\n⚠️  Security issues found! ${unprotected} unprotected routes, ${errors} errors.`)
  }
}

testProtectedRoutes().catch(console.error)

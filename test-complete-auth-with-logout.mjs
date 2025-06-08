#!/usr/bin/env node
// test-complete-auth-with-logout.mjs
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'

console.log('🧪 Testing Complete Authentication Flow with Logout\n')

const baseUrl = 'http://localhost:3000'
const cookieFile = 'temp-cookies.txt'
const testCredentials = {
  email: 'test@cloudless.gr',
  password: 'TestPassword123!'
}

// Test sequence
try {
  // 1️⃣ Test: Check initial session (should be unauthenticated)
  console.log('1️⃣ Testing initial session (unauthenticated)...')
  try {
    const sessionResponse = execSync(
      `curl -s -c ${cookieFile} -b ${cookieFile} ${baseUrl}/api/auth/session`,
      { encoding: 'utf8' }
    )
    const sessionData = JSON.parse(sessionResponse)

    if (!sessionData.authenticated) {
      console.log('✅ Initial session correctly reports unauthenticated')
    } else {
      console.log('❌ Unexpected: Initial session reports authenticated')
    }
  } catch (error) {
    console.log('❌ Session endpoint failed:', error.message)
  }
  // 2️⃣ Test: Login with credentials
  console.log('\n2️⃣ Testing login...')
  const tempJsonFile = '.test-login.json'
  try {
    // Write JSON to temp file to avoid command line escaping issues
    writeFileSync(tempJsonFile, JSON.stringify(testCredentials))

    const loginResponse = execSync(
      `curl -s -X POST -c ${cookieFile} -b ${cookieFile} -H "Content-Type: application/json" -d @${tempJsonFile} ${baseUrl}/api/auth/supabase-login`,
      { encoding: 'utf8' }
    )

    const loginData = JSON.parse(loginResponse)

    if (loginData.success && loginData.authenticated) {
      console.log('✅ Login successful')
      console.log(`   User: ${loginData.user.email}`)
    } else {
      console.log('❌ Login failed:', loginData)
      throw new Error('Login failed')
    }
  } catch (error) {
    console.log('❌ Login failed:', error.message)
    throw error
  } finally {
    // Clean up temp file if it exists
    try {
      unlinkSync(tempJsonFile)
    } catch (err) {
      // File might not exist, that's ok
    }
  }

  // 3️⃣ Test: Session check after login (should be authenticated)
  console.log('\n3️⃣ Testing session after login...')
  try {
    const sessionResponse = execSync(
      `curl -s -c ${cookieFile} -b ${cookieFile} ${baseUrl}/api/auth/session`,
      { encoding: 'utf8' }
    )
    const sessionData = JSON.parse(sessionResponse)

    if (sessionData.authenticated) {
      console.log('✅ Session correctly reports authenticated after login')
      console.log(`   User: ${sessionData.user.email}`)
    } else {
      console.log('❌ Session failed to persist after login')
    }
  } catch (error) {
    console.log('❌ Session check failed:', error.message)
  }

  // 4️⃣ Test: Logout
  console.log('\n4️⃣ Testing logout...')
  try {
    const logoutResponse = execSync(
      `curl -s -X POST -c ${cookieFile} -b ${cookieFile} -H "Content-Type: application/json" ${baseUrl}/api/auth/logout`,
      { encoding: 'utf8' }
    )

    const logoutData = JSON.parse(logoutResponse)

    if (logoutData.success) {
      console.log('✅ Logout successful')
    } else {
      console.log('❌ Logout failed:', logoutData)
    }
  } catch (error) {
    console.log('❌ Logout failed:', error.message)
  }

  // 5️⃣ Test: Session check after logout (should be unauthenticated)
  console.log('\n5️⃣ Testing session after logout...')
  try {
    const sessionResponse = execSync(
      `curl -s -c ${cookieFile} -b ${cookieFile} ${baseUrl}/api/auth/session`,
      { encoding: 'utf8' }
    )
    const sessionData = JSON.parse(sessionResponse)

    if (!sessionData.authenticated) {
      console.log('✅ Session correctly reports unauthenticated after logout')
    } else {
      console.log('❌ Session still reports authenticated after logout')
      console.log('   This might indicate cookies were not properly cleared')
    }
  } catch (error) {
    console.log('❌ Session check failed:', error.message)
  }

  console.log('\n🎯 Complete Authentication Flow Test Complete!')
  console.log('✨ All authentication endpoints tested')

} catch (error) {
  console.error('❌ Test suite failed:', error.message)
} finally {
  // Cleanup
  try {
    unlinkSync(cookieFile)
  } catch (err) {
    // Cookie file might not exist, that's ok
  }
  
  try {
    unlinkSync('.test-login.json')
  } catch (err) {
    // JSON file might not exist, that's ok
  }
  
  console.log('\n🧹 Cleaned up temp files')
  console.log('\n📱 Next: Test the browser flow at http://localhost:3000/auth/login')
}

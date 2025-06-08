// test-complete-auth-flow.mjs - Test the complete Supabase authentication flow using cookies

import { execSync } from 'child_process'
import fs from 'fs'

console.log('🧪 Testing Complete Authentication Flow\n')

const baseUrl = 'http://localhost:3000'
const cookieFile = '.test-cookies.txt'

// 1️⃣ Test: Check unauthenticated session
console.log('1️⃣ Testing session endpoint (unauthenticated)...')
try {
  const sessionResponse = execSync(`curl -s -c ${cookieFile} ${baseUrl}/api/auth/session`, { encoding: 'utf8' })
  const session = JSON.parse(sessionResponse)

  if (session.authenticated === false) {
    console.log('✅ Session endpoint correctly reports unauthenticated state')
  } else {
    console.log('❌ Unexpected session response:', session)
  }
} catch (error) {
  console.log('❌ Session endpoint failed:', error.message)
}

// 2️⃣ Test: Login with credentials
console.log('\n2️⃣ Testing login endpoint...')
try {
  const loginData = {
    email: 'test@cloudless.gr',
    password: 'TestPassword123!'
  }

  // Write JSON to temp file to avoid command line escaping issues
  const tempJsonFile = '.test-login.json'
  fs.writeFileSync(tempJsonFile, JSON.stringify(loginData))

  const loginResponse = execSync(
    `curl -s -X POST -c ${cookieFile} -b ${cookieFile} -H "Content-Type: application/json" -d @${tempJsonFile} ${baseUrl}/api/auth/supabase-login`,
    { encoding: 'utf8' }
  )

  // Clean up temp file
  fs.unlinkSync(tempJsonFile)

  const loginResult = JSON.parse(loginResponse)

  if (loginResult.authenticated) {
    console.log('✅ Login succeeded via API')
  } else {
    console.log('⚠️ Login failed: ', loginResult)
  }
} catch (error) {
  console.log('❌ Login endpoint failed:', error.message)
}

// 2️⃣.5 Test: Check session again after login
console.log('\n2️⃣.5 Re-checking session after login...')
try {
  const sessionAfter = execSync(`curl -s -b ${cookieFile} ${baseUrl}/api/auth/session`, { encoding: 'utf8' })
  const session2 = JSON.parse(sessionAfter)

  if (session2.authenticated) {
    console.log('✅ Session is now authenticated after login')
  } else {
    console.log('❌ Session did not persist after login')
  }
} catch (error) {
  console.log('❌ Session recheck failed:', error.message)
}

// 3️⃣ Test: Middleware check
console.log('\n3️⃣ Testing middleware configuration...')
try {
  const oldMiddlewareExists = fs.existsSync('./middleware/01.auth.global.ts')
  const newMiddlewareExists = fs.existsSync('./middleware/02.auth-unified.global.ts')

  if (!oldMiddlewareExists && newMiddlewareExists) {
    console.log('✅ Middleware configuration is correct')
  } else {
    console.log('⚠️ Middleware setup may be incomplete:')
    console.log('  - Old middleware present:', oldMiddlewareExists)
    console.log('  - New middleware present:', newMiddlewareExists)
  }
} catch (error) {
  console.log('❌ Middleware check failed:', error.message)
}

// 🧹 Cleanup temp files
const tempFiles = [cookieFile, '.test-login.json']
tempFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file)
  }
})
console.log('\n🧹 Cleaned up temp files')

console.log('\n🎯 Test Complete!')
console.log('Next step: Try logging in via the browser at http://localhost:3000/auth/login')

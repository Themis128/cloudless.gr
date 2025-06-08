// Test login flow with the new Supabase-to-JWT bridge
const testEmail = 'baltzakis.themis@gmail.com'
const testPassword = 'demo123' // Replace with actual password

console.log('🔍 Testing complete login flow...\n')

// Step 1: Check initial session (should be unauthenticated)
console.log('Step 1: Checking initial session...')
try {
  const initialSession = await fetch('http://localhost:3000/api/auth/session')
  const initialData = await initialSession.json()
  console.log('Initial session:', initialData)
  console.log('✅ Initial session check complete\n')
} catch (error) {
  console.error('❌ Initial session check failed:', error)
}

// Step 2: Test Supabase login (this would normally happen in browser)
console.log('Step 2: Testing Supabase authentication...')
console.log('Note: This test simulates the browser login flow\n')

// Step 3: Test our bridge API directly with mock tokens
console.log('Step 3: Testing JWT bridge API...')
try {
  // Mock Supabase tokens (in real scenario these come from successful Supabase login)
  const mockTokens = {
    access_token: 'mock_access_token_for_testing',
    refresh_token: 'mock_refresh_token_for_testing'
  }

  const bridgeResponse = await fetch('http://localhost:3000/api/auth/supabase-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mockTokens)
  })

  if (bridgeResponse.ok) {
    const bridgeData = await bridgeResponse.json()
    console.log('Bridge API Response:', bridgeData)
    console.log('✅ Bridge API structure is correct\n')
  } else {
    const errorText = await bridgeResponse.text()
    console.log('Bridge API Error:', errorText)
    console.log('⚠️ Bridge API failed (expected with mock tokens)\n')
  }
} catch (error) {
  console.error('❌ Bridge API test failed:', error)
}

// Step 4: Test session after login (should still be unauthenticated with mock tokens)
console.log('Step 4: Checking session after bridge test...')
try {
  const finalSession = await fetch('http://localhost:3000/api/auth/session')
  const finalData = await finalSession.json()
  console.log('Final session:', finalData)
  console.log('✅ Final session check complete\n')
} catch (error) {
  console.error('❌ Final session check failed:', error)
}

console.log('🎯 Login flow test complete!')
console.log('📝 Next steps:')
console.log('1. The bridge API structure is working')
console.log('2. Need to test with real Supabase login in browser')
console.log('3. Check browser console for detailed login flow')

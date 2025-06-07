console.log('🔍 Testing basic Node.js execution...')
console.log('Node version:', process.version)
console.log('Current directory:', process.cwd())

// Test environment variable loading
require('dotenv').config()
console.log('Environment variables loaded')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

console.log('SUPABASE_URL exists:', !!supabaseUrl)
console.log('SUPABASE_ANON_KEY exists:', !!supabaseKey)

if (supabaseUrl) {
  console.log('URL preview:', supabaseUrl.substring(0, 20) + '...')
}

if (supabaseKey) {
  console.log('Key length:', supabaseKey.length)
  console.log('Key preview:', supabaseKey.substring(0, 10) + '...' + supabaseKey.substring(supabaseKey.length - 10))
}

console.log('✅ Basic test completed successfully!')

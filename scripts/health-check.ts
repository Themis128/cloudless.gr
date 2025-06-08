/**
 * Supabase Health Check for Nuxt 3
 * Validates:
 * - ENV config
 * - Supabase client connectivity
 * - Auth flow (logged-in user or not)
 * - Optional: Ping database table
 */

export async function runHealthCheck() {
  console.log('🏥 Starting Supabase Health Check...')

  const results = {
    envVariables: false,
    supabaseConnection: false,
    authFlow: false,
    dbAccess: false,
    errors: [] as string[],
  }

  try {
    // Check environment variables
    console.log('🔍 Checking environment variables...')
    const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {}

    const url = config?.public?.supabase?.url
    const key = config?.public?.supabase?.anonKey

    if (!url) results.errors.push('❌ SUPABASE_URL is missing from runtime config')
    if (!key) results.errors.push('❌ SUPABASE_ANON_KEY is missing from runtime config')

    if (url && key) {
      results.envVariables = true
      console.log('✅ Environment variables are OK')
    }

    // Check Supabase client
    console.log('🔍 Testing Supabase connection...')
    const supabase = typeof useSupabaseClient === 'function' ? useSupabaseClient() : null

    if (!supabase) {
      results.errors.push('❌ Supabase client not initialized')
    } else {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error?.message?.includes('fetch')) {
          results.errors.push(`❌ Network error: ${error.message}`)
        } else {
          results.supabaseConnection = true
          console.log('✅ Supabase connection is working')
        }
      } catch (err: any) {
        results.errors.push(`❌ Failed to connect to Supabase: ${err.message}`)
      }

      // Optional: test DB access (change table name as needed)
      try {
        const { error: dbError } = await supabase.from('users').select('*').limit(1)

        if (dbError) {
          results.errors.push(`❌ DB access failed: ${dbError.message}`)
        } else {
          results.dbAccess = true
          console.log('✅ Supabase DB access OK')
        }
      } catch (dbFail: any) {
        results.errors.push(`❌ Exception while accessing DB: ${dbFail.message}`)
      }
    }

    // Auth flow check
    console.log('🔍 Checking auth flow...')
    try {
      const user = typeof useSupabaseUser === 'function' ? useSupabaseUser() : null
      if (user?.value) {
        results.authFlow = true
        console.log(`✅ User is authenticated: ${user.value.email}`)
      } else {
        results.authFlow = true // it's fine to not be logged in
        console.log('ℹ️ No authenticated user (OK for public pages)')
      }
    } catch (authError: any) {
      results.errors.push(`❌ Auth check error: ${authError.message}`)
    }
  } catch (unexpected: any) {
    results.errors.push(`❌ Unexpected error: ${unexpected.message}`)
  }

  // Final Output
  console.groupCollapsed('📊 Supabase Health Check Summary')
  console.table({
    'Environment Variables': results.envVariables ? '✅ OK' : '❌ Failed',
    'Supabase Connection': results.supabaseConnection ? '✅ OK' : '❌ Failed',
    'Auth Flow': results.authFlow ? '✅ OK' : '❌ Failed',
    'DB Access': results.dbAccess ? '✅ OK' : '❌ Failed',
  })
  if (results.errors.length > 0) {
    console.warn('\n❌ Issues Found:')
    results.errors.forEach(err => console.warn('•', err))
  } else {
    console.log('\n🎉 All checks passed!')
  }
  console.groupEnd()

  return results
}

// Auto-run during local development in browser
if (process.client && process.dev) {
  setTimeout(() => {
    runHealthCheck()
  }, 2000)
}

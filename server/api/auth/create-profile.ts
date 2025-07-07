import { defineEventHandler, readBody } from 'h3'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { id, email, full_name = '', email_verified = false } = body

  if (!id || !email) {
    return { success: false, error: 'Missing required fields: id or email' }
  }

  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey,
    {
      auth: { storageKey: 'supabase.admin.create-profile' }
    }
  )

  try {
    const profileData = {
      id,
      email,
      full_name,
      role: 'user',
      is_active: true,
      email_verified,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      profile: data
    }
  } catch (err: any) {
    console.error('Profile creation error:', err)
    return {
      success: false,
      error: err.message || 'Profile creation failed'
    }
  }
})

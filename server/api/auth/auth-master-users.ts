import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { H3Event, EventHandlerRequest } from 'h3'
import { defineEventHandler, getQuery, getMethod, readBody, createError, useRuntimeConfig } from '#imports'
/**
 * Auth-Master Only User Management API
 * Manages users entirely through Supabase auth-master metadata
 */

export default defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
  try {
    const config = useRuntimeConfig()
    const method = getMethod(event)

    // Create admin Supabase client for user management
    const supabase: SupabaseClient = createClient(
      config.public.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    switch (method) {
      case 'GET':
        return await getUserWithRole(event, supabase)
      case 'POST':
        return await createUserWithRole(event, supabase)
      case 'PUT':
        return await updateUserRole(event, supabase)
      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error: unknown) {
    console.error('Auth-master user management error:', error)
    if (error instanceof Error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Failed to manage user'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to manage user'
    })
  }
})

/**
 * Get user with role from auth-master
 */
async function getUserWithRole(event: H3Event<EventHandlerRequest>, supabase: SupabaseClient) {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    })
  }

  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(userId)
    if (error) throw error
    if (!user || !user.user) throw new Error('User not found')
    return {
      success: true,
      user: {
        id: user.user.id,
        email: user.user.email,
        role: user.user.user_metadata?.role || user.user.app_metadata?.role || 'user',
        is_active: user.user.app_metadata?.is_active !== false,
        created_at: user.user.created_at,
        last_sign_in_at: user.user.last_sign_in_at,
        email_confirmed_at: user.user.email_confirmed_at
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError({
        statusCode: 404,
        statusMessage: error.message || 'User not found'
      })
    }
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }
}

/**
 * Create user with role in auth-master
 */
async function createUserWithRole(event: H3Event<EventHandlerRequest>, supabase: SupabaseClient) {
  const body = await readBody<Record<string, unknown>>(event)
  const { email, password, role = 'user', full_name } = body as { email?: string; password?: string; role?: string; full_name?: string }

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required'
    })
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        role,
        full_name
      },
      app_metadata: { 
        is_active: true 
      },
      email_confirm: true // Auto-confirm email for admin-created users
    })

    if (error) throw error
    if (!data || !data.user) throw new Error('User creation failed')
    return {
      success: true,
      message: 'User created successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role,
        is_active: data.user.app_metadata?.is_active
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message || 'Failed to create user'
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'Failed to create user'
    })
  }
}

/**
 * Update user role in auth-master
 */
async function updateUserRole(event: H3Event<EventHandlerRequest>, supabase: SupabaseClient) {
  const body = await readBody<Record<string, unknown>>(event)
  const { userId, role, is_active } = body as { userId?: string; role?: string; is_active?: boolean }

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    })
  }

  try {
    const updateData: Record<string, unknown> = {}

    if (role) {
      updateData.user_metadata = { role }
    }

    if (typeof is_active === 'boolean') {
      updateData.app_metadata = { is_active }
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updateData)

    if (error) throw error
    if (!data || !data.user) throw new Error('User update failed')
    return {
      success: true,
      message: 'User updated successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role,
        is_active: data.user.app_metadata?.is_active
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message || 'Failed to update user'
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'Failed to update user'
    })
  }
}

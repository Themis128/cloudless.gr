import { defineStore } from 'pinia'
import type { Database } from '~/types/supabase.d'
import { getSupabaseClient } from '~/composables/useSupabase'

type UserProfile = {
  id: string
  email: string
  full_name?: string | null
  role: 'user' | 'admin' | 'moderator'
  is_active: boolean
  email_verified: boolean
  failed_login_attempts: number
  locked_until?: string | null
  last_login?: string | null
  reset_token?: string | null
  reset_token_expires?: string | null
  created_at: string
  updated_at: string
}

export const useSupabaseStore = defineStore('supabase', {
  state: () => ({
    user: null as UserProfile | null,
    loading: false,
    error: null as string | null,
    success: false,
  }),
  
  actions: {    async fetchUserProfile(email: string) {
      this.loading = true
      this.error = null
      const supabase = getSupabaseClient() as import('@supabase/supabase-js').SupabaseClient<Database>
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, is_active, email_verified, failed_login_attempts, locked_until, last_login, reset_token, reset_token_expires, created_at, updated_at')
          .eq('email', email)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('No account found with this email address.')
          } else if (error.code === 'PGRST119') {
            throw new Error('Multiple accounts found with this email. Please contact support.')
          } else {
            throw new Error(`Database error: ${error.message}`)
          }
        }

        if (!data) {
          throw new Error('No account found with this email address.')
        }
        
        if (!data.is_active) {
          throw new Error('Account is deactivated. Please contact support.')
        }
        
        this.user = data
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch user profile.'
        this.error = errorMsg
        console.error('Error fetching user profile:', err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async sendResetPassword(email: string) {
      this.loading = true
      this.error = null
      this.success = false
      const supabase = getSupabaseClient() as import('@supabase/supabase-js').SupabaseClient<Database>
      
      try {
        // Check user profile
        await this.fetchUserProfile(email)
        
        // Generate secure reset token and save to database
        const resetToken =
          Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

        await supabase
          .from('profiles')
          .update({
            reset_token: resetToken,
            reset_token_expires: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        // Send password reset email through Supabase Auth
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password?token=${resetToken}`,
        })

        if (error) {
          throw error
        }
        
        this.success = true
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Password reset failed.'
        this.error = errorMsg
        throw err
      } finally {
        this.loading = false
      }
    },

    resetState() {
      this.user = null
      this.loading = false
      this.error = null
      this.success = false
    },
  },
});

import { defineStore } from 'pinia'
import type { Database } from '~/types/supabase.d'

type DbProfile = Database['public']['Tables']['profiles']['Row']

interface AdminStats {
  totalUsers: number
  activeUsers: number
  adminUsers: number
  lockedUsers: number
  recentSignups: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  uptime: string
  lastChecked: string
  issues: string[]
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    users: [] as DbProfile[],
    stats: null as AdminStats | null,
    systemHealth: null as SystemHealth | null,
    loading: false,
    error: null as string | null,
    lastUpdated: null as string | null,
  }),

  getters: {
    isAdmin: () => {
      const authStore = useAuthStore()
      return authStore.user?.role === 'admin'
    },
    
    totalUsers: (state) => state.users.length,
    
    activeUsers: (state) => state.users.filter(user => user.is_active).length,
    
    lockedUsers: (state) => state.users.filter(user => {
      if (!user.locked_until) return false
      return new Date(user.locked_until) > new Date()
    }).length,
    
    recentUsers: (state) => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return state.users.filter(user => new Date(user.created_at) > sevenDaysAgo)
    },
  },

  actions: {
    // Initialize admin data
    async initialize() {
      const authStore = useAuthStore()
      
      if (authStore.user?.role === 'admin') {
        await this.loadUsers()
        await this.updateStats()
        await this.checkSystemHealth()
      }
    },

    // Load all users (admin only)
    async loadUsers(): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore()
      
      if (authStore.user?.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }

      this.loading = true
      this.error = null

      try {
        // Use service role to bypass RLS for admin operations
        const { createClient } = await import('@supabase/supabase-js')
        const config = useRuntimeConfig()
        
        const serviceClient = createClient(
          config.public.supabaseUrl,
          config.supabaseServiceKey
        )

        const { data, error } = await serviceClient
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        this.users = data || []
        this.lastUpdated = new Date().toISOString()
        
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load users'
        this.error = errorMsg
        console.error('Error loading users:', err)
        return { success: false, error: errorMsg }
      } finally {
        this.loading = false
      }
    },

    // Update user status (admin only)
    async updateUserStatus(userId: string, updates: Partial<DbProfile>): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore()
      
      if (authStore.user?.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }

      this.loading = true
      this.error = null

      try {
        const { createClient } = await import('@supabase/supabase-js')
        const config = useRuntimeConfig()
        
        const serviceClient = createClient(
          config.public.supabaseUrl,
          config.supabaseServiceKey
        )

        const updateData = {
          ...updates,
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await serviceClient
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single()

        if (error) throw error

        if (data) {
          // Update local state
          const userIndex = this.users.findIndex(user => user.id === userId)
          if (userIndex !== -1) {
            this.users[userIndex] = { ...this.users[userIndex], ...data }
          }
        }

        await this.updateStats()
        
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update user'
        this.error = errorMsg
        console.error('Error updating user:', err)
        return { success: false, error: errorMsg }
      } finally {
        this.loading = false
      }
    },

    // Create admin user (super admin only)
    async createAdminUser(email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore()
      
      if (authStore.user?.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }

      this.loading = true
      this.error = null

      try {
        const { createClient } = await import('@supabase/supabase-js')
        const config = useRuntimeConfig()
        
        const serviceClient = createClient(
          config.public.supabaseUrl,
          config.supabaseServiceKey
        )

        // Create user in auth.users
        const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Failed to create auth user')

        // Create profile with admin role
        const profileData = {
          id: authData.user.id,
          email,
          full_name: fullName,
          role: 'admin' as const,
          is_active: true,
          email_verified: true,
          failed_login_attempts: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: profileData2, error: profileError } = await serviceClient
          .from('profiles')
          .insert(profileData)
          .select()
          .single()

        if (profileError) throw profileError

        if (profileData2) {
          this.users.unshift(profileData2)
        }

        await this.updateStats()
        
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create admin user'
        this.error = errorMsg
        console.error('Error creating admin user:', err)
        return { success: false, error: errorMsg }
      } finally {
        this.loading = false
      }
    },

    // Delete user (admin only)
    async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore()
      
      if (authStore.user?.role !== 'admin') {
        return { success: false, error: 'Admin access required' }
      }

      if (authStore.user?.id === userId) {
        return { success: false, error: 'Cannot delete your own account' }
      }

      this.loading = true
      this.error = null

      try {
        const { createClient } = await import('@supabase/supabase-js')
        const config = useRuntimeConfig()
        
        const serviceClient = createClient(
          config.public.supabaseUrl,
          config.supabaseServiceKey
        )

        // Delete from auth.users (this will cascade to profiles via RLS)
        const { error: authError } = await serviceClient.auth.admin.deleteUser(userId)
        if (authError) throw authError

        // Remove from local state
        this.users = this.users.filter(user => user.id !== userId)
        
        await this.updateStats()
        
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete user'
        this.error = errorMsg
        console.error('Error deleting user:', err)
        return { success: false, error: errorMsg }
      } finally {
        this.loading = false
      }
    },

    // Update statistics
    async updateStats() {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      this.stats = {
        totalUsers: this.users.length,
        activeUsers: this.users.filter(user => user.is_active).length,
        adminUsers: this.users.filter(user => user.role === 'admin').length,
        lockedUsers: this.users.filter(user => {
          if (!user.locked_until) return false
          return new Date(user.locked_until) > now
        }).length,
        recentSignups: this.users.filter(user => 
          new Date(user.created_at) > sevenDaysAgo
        ).length,
      }
    },

    // Check system health
    async checkSystemHealth() {
      try {
        const supabase = useSupabaseClient<Database>()
        
        // Simple health check - try to query the database
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)

        const issues: string[] = []
        
        if (error) {
          issues.push(`Database connectivity: ${error.message}`)
        }

        // Check for locked users
        const lockedCount = this.lockedUsers
        if (lockedCount > 5) {
          issues.push(`High number of locked accounts: ${lockedCount}`)
        }

        // Determine overall status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy'
        if (issues.length > 0) {
          status = issues.some(issue => issue.includes('Database')) ? 'critical' : 'warning'
        }

        this.systemHealth = {
          status,
          uptime: this.calculateUptime(),
          lastChecked: new Date().toISOString(),
          issues
        }
      } catch (err) {
        console.error('Error checking system health:', err)
        this.systemHealth = {
          status: 'critical',
          uptime: 'Unknown',
          lastChecked: new Date().toISOString(),
          issues: ['System health check failed']
        }
      }
    },

    // Calculate uptime (placeholder implementation)
    calculateUptime(): string {
      // In a real app, this would check actual system uptime
      // For now, return a placeholder
      return '99.9%'
    },

    // Search users
    searchUsers(query: string): DbProfile[] {
      if (!query) return this.users

      const searchTerm = query.toLowerCase()
      return this.users.filter(user => 
        user.email.toLowerCase().includes(searchTerm) ||
        user.full_name?.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
      )
    },

    // Reset store
    resetStore() {
      this.users = []
      this.stats = null
      this.systemHealth = null
      this.loading = false
      this.error = null
      this.lastUpdated = null
    },
  },
})

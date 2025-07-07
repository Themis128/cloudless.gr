<template>
  <div class="dashboard-container">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">Dashboard</h1>
        <div class="user-info">
          <span class="welcome-text">Welcome, {{ userDisplayName }}</span>
          <button class="sign-out-btn" :disabled="signingOut" @click="handleSignOut">
            {{ signingOut ? 'Signing out...' : 'Sign Out' }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="dashboard-main">
      <div class="dashboard-content">
        <!-- User Profile Card -->
        <div class="profile-card">
          <h2 class="card-title">Profile Information</h2>
          <div class="profile-info">
            <div class="info-item">
              <label class="info-label">Email:</label>
              <span class="info-value">{{ userProfile?.email || 'Not available' }}</span>
            </div>
            <div class="info-item">
              <label class="info-label">Full Name:</label>
              <span class="info-value">{{ userProfile?.full_name || 'Not set' }}</span>
            </div>
            <div class="info-item">
              <label class="info-label">Role:</label>
              <span class="info-value badge" :class="`badge--${userProfile?.role || 'user'}`">
                {{ userProfile?.role || 'user' }}
              </span>
            </div>
            <div class="info-item">
              <label class="info-label">Status:</label>
              <span class="info-value badge" :class="userProfile?.is_active ? 'badge--active' : 'badge--inactive'">
                {{ userProfile?.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <div class="info-item">
              <label class="info-label">Email Verified:</label>
              <span class="info-value badge" :class="userProfile?.email_verified ? 'badge--verified' : 'badge--unverified'">
                {{ userProfile?.email_verified ? 'Verified' : 'Not Verified' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Actions Card -->
        <div class="actions-card">
          <h2 class="card-title">Quick Actions</h2>
          <div class="actions-grid">
            <button class="action-btn" @click="refreshProfile">
              <span class="action-icon">🔄</span>
              Refresh Profile
            </button>
            <button class="action-btn" @click="viewProjects">
              <span class="action-icon">📁</span>
              View Projects
            </button>
            <button class="action-btn" @click="editProfile">
              <span class="action-icon">✏️</span>
              Edit Profile
            </button>
            <button class="action-btn" @click="viewSettings">
              <span class="action-icon">⚙️</span>
              Settings
            </button>
          </div>
        </div>

        <!-- Recent Activity Card -->
        <div class="activity-card">
          <h2 class="card-title">Recent Activity</h2>
          <div class="activity-list">
            <div class="activity-item">
              <span class="activity-icon">🔐</span>
              <div class="activity-content">
                <span class="activity-text">Signed in successfully</span>
                <span class="activity-time">{{ formatTime(new Date()) }}</span>
              </div>
            </div>
            <div class="activity-item">
              <span class="activity-icon">👤</span>
              <div class="activity-content">
                <span class="activity-text">Profile loaded</span>
                <span class="activity-time">{{ formatTime(new Date()) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'admin' | 'moderator'
  is_active: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
}

// State
const user = ref<User | null>(null)
const userProfile = ref<UserProfile | null>(null)
const loading = ref(true)
const signingOut = ref(false)
const error = ref('')

// Computed
const userDisplayName = computed(() => {
  return userProfile.value?.full_name || user.value?.email?.split('@')[0] || 'User'
})

// Methods
const loadUserData = async () => {
  try {
    loading.value = true
    
    // Get the manual Supabase client
    const { useManualSupabaseClient } = await import('~/composables/useManualSupabase')
    const supabase = useManualSupabaseClient()
    
    // Get current user
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ Error getting user:', userError)
      await navigateTo('/auth')
      return
    }
    
    if (!currentUser) {
      console.log('❌ No authenticated user found')
      await navigateTo('/auth')
      return
    }
    
    user.value = currentUser
    console.log('✅ User loaded:', currentUser.email)
    
    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()
    
    if (profileError) {
      console.error('❌ Error getting profile:', profileError)
      error.value = 'Failed to load profile data'
    } else {
      userProfile.value = profile
      console.log('✅ Profile loaded:', profile.email)
    }
    
  } catch (err) {
    console.error('❌ Error loading user data:', err)
    error.value = 'Failed to load user data'
  } finally {
    loading.value = false
  }
}

const handleSignOut = async () => {
  try {
    signingOut.value = true
    
    const { useManualSupabaseClient } = await import('~/composables/useManualSupabase')
    const supabase = useManualSupabaseClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('❌ Sign out error:', error)
      return
    }
    
    console.log('✅ Signed out successfully')
    await navigateTo('/auth')
    
  } catch (err) {
    console.error('❌ Sign out exception:', err)
  } finally {
    signingOut.value = false
  }
}

const refreshProfile = async () => {
  await loadUserData()
}

const viewProjects = () => {
  navigateTo('/projects')
}

const editProfile = () => {
  navigateTo('/profile/edit')
}

const viewSettings = () => {
  navigateTo('/settings')
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

// Lifecycle
onMounted(() => {
  loadUserData()
})

// Meta
definePageMeta({
  middleware: 'auth'
})

useHead({
  title: 'Dashboard - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Your Cloudless.gr dashboard' }
  ]
})
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.dashboard-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.welcome-text {
  color: #6b7280;
  font-weight: 500;
}

.sign-out-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sign-out-btn:hover:not(:disabled) {
  background: #dc2626;
}

.sign-out-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-content {
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .dashboard-content {
    grid-template-columns: 2fr 1fr;
    grid-template-areas: 
      "profile actions"
      "activity actions";
  }
  
  .profile-card {
    grid-area: profile;
  }
  
  .actions-card {
    grid-area: actions;
  }
  
  .activity-card {
    grid-area: activity;
  }
}

.profile-card,
.actions-card,
.activity-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 500;
  color: #374151;
}

.info-value {
  color: #6b7280;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.badge--user {
  background: #dbeafe;
  color: #1e40af;
}

.badge--admin {
  background: #fef3c7;
  color: #92400e;
}

.badge--moderator {
  background: #e0e7ff;
  color: #3730a3;
}

.badge--active {
  background: #d1fae5;
  color: #065f46;
}

.badge--inactive {
  background: #fee2e2;
  color: #991b1b;
}

.badge--verified {
  background: #d1fae5;
  color: #065f46;
}

.badge--unverified {
  background: #fef3c7;
  color: #92400e;
}

.actions-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-weight: 500;
  color: #374151;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.action-icon {
  font-size: 1.25rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.activity-icon {
  font-size: 1.25rem;
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.activity-text {
  font-weight: 500;
  color: #374151;
}

.activity-time {
  font-size: 0.875rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .dashboard-main {
    padding: 1rem;
  }
  
  .user-info {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>

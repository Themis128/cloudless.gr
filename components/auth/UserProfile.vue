<template>
  <div class="user-profile-container">
    <div class="profile-header">
      <div class="profile-avatar">
        <div class="avatar-placeholder">
          <v-icon size="48" color="white">mdi-account</v-icon>
        </div>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{{ user?.name || 'User' }}</h1>
        <p class="profile-email">{{ user?.email }}</p>
        <div class="profile-roles">
          <span v-for="role in userRoles" :key="role.id" class="role-badge">
            {{ role.name }}
          </span>
        </div>
      </div>
      <div class="profile-actions">
        <v-btn
          color="primary"
          variant="outlined"
          @click="showEditModal = true"
          :disabled="!canEditProfile"
        >
          <v-icon>mdi-pencil</v-icon>
          Edit Profile
        </v-btn>
      </div>
    </div>

    <div class="profile-content">
      <div class="profile-section">
        <h2 class="section-title">Account Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <label class="info-label">Full Name</label>
            <span class="info-value">{{ user?.name }}</span>
          </div>
          <div class="info-item">
            <label class="info-label">Email Address</label>
            <span class="info-value">{{ user?.email }}</span>
          </div>
          <div class="info-item">
            <label class="info-label">Account Status</label>
            <span class="info-value">
              <v-chip :color="user?.status === 'active' ? 'success' : 'error'" size="small">
                {{ user?.status }}
              </v-chip>
            </span>
          </div>
          <div class="info-item">
            <label class="info-label">Member Since</label>
            <span class="info-value">{{ formatDate(user?.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <h2 class="section-title">Roles & Permissions</h2>
        <div class="roles-section">
          <div class="roles-list">
            <div v-for="role in userRoles" :key="role.id" class="role-item">
              <div class="role-header">
                <h3 class="role-name">{{ role.name }}</h3>
                <span class="role-description">{{ role.description }}</span>
              </div>
              <div class="role-permissions">
                <h4>Permissions:</h4>
                <div class="permissions-grid">
                  <span 
                    v-for="permission in role.permissions" 
                    :key="permission.id"
                    class="permission-badge"
                  >
                    {{ permission.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <h2 class="section-title">Security</h2>
        <div class="security-actions">
          <v-btn
            color="warning"
            variant="outlined"
            @click="showChangePasswordModal = true"
          >
            <v-icon>mdi-lock-reset</v-icon>
            Change Password
          </v-btn>
          <v-btn
            color="info"
            variant="outlined"
            @click="showTwoFactorModal = true"
          >
            <v-icon>mdi-two-factor-authentication</v-icon>
            Two-Factor Authentication
          </v-btn>
        </div>
      </div>

      <div class="profile-section">
        <h2 class="section-title">Account Activity</h2>
        <div class="activity-list">
          <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
            <div class="activity-icon">
              <v-icon :color="activity.color">{{ activity.icon }}</v-icon>
            </div>
            <div class="activity-content">
              <p class="activity-description">{{ activity.description }}</p>
              <span class="activity-time">{{ formatDate(activity.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <v-dialog v-model="showEditModal" max-width="600px">
      <v-card>
        <v-card-title>Edit Profile</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleUpdateProfile">
            <v-text-field
              v-model="editForm.name"
              label="Full Name"
              required
              :disabled="isLoading"
            />
            <v-text-field
              v-model="editForm.email"
              label="Email Address"
              type="email"
              required
              :disabled="isLoading"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showEditModal = false" :disabled="isLoading">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="handleUpdateProfile"
            :loading="isLoading"
            :disabled="!editForm.name || !editForm.email"
          >
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Change Password Modal -->
    <v-dialog v-model="showChangePasswordModal" max-width="500px">
      <v-card>
        <v-card-title>Change Password</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleChangePassword">
            <v-text-field
              v-model="passwordForm.currentPassword"
              label="Current Password"
              type="password"
              required
              :disabled="isLoading"
            />
            <v-text-field
              v-model="passwordForm.newPassword"
              label="New Password"
              type="password"
              required
              :disabled="isLoading"
            />
            <v-text-field
              v-model="passwordForm.confirmPassword"
              label="Confirm New Password"
              type="password"
              required
              :disabled="isLoading"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showChangePasswordModal = false" :disabled="isLoading">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="handleChangePassword"
            :loading="isLoading"
            :disabled="!isPasswordFormValid"
          >
            Change Password
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Two-Factor Authentication Modal -->
    <v-dialog v-model="showTwoFactorModal" max-width="500px">
      <v-card>
        <v-card-title>Two-Factor Authentication</v-card-title>
        <v-card-text>
          <p>Two-factor authentication is not yet implemented.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showTwoFactorModal = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  userRoles?: Array<{
    id: number
    role: {
      id: number
      name: string
      description: string
      permissions: Array<{
        id: number
        name: string
        description: string
      }>
    }
    assignedAt: string
    expiresAt?: string
    isActive: boolean
  }>
}

interface Activity {
  id: number
  description: string
  timestamp: string
  icon: string
  color: string
}

// Props
const props = defineProps<{
  user?: User | null
}>()

// Emits
const emit = defineEmits<{
  updated: [user: User]
  error: [error: string]
}>()

// State
const isLoading = ref(false)
const showEditModal = ref(false)
const showChangePasswordModal = ref(false)
const showTwoFactorModal = ref(false)

// Edit form
const editForm = ref({
  name: '',
  email: ''
})

// Password form
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Auth store
const authStore = useAuthStore()

// Computed
const userRoles = computed(() => {
  if (!props.user?.userRoles) return []
  return props.user.userRoles
    .filter(ur => ur.isActive)
    .map(ur => ur.role)
})

const canEditProfile = computed(() => {
  return authStore.isAuthenticated && 
         (authStore.isAdmin || authStore.user?.id === props.user?.id)
})

const isPasswordFormValid = computed(() => {
  return passwordForm.value.currentPassword &&
         passwordForm.value.newPassword &&
         passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword === passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword.length >= 8
})

// Sample activity data
const recentActivity = ref<Activity[]>([
  {
    id: 1,
    description: 'Logged in from Chrome on Windows',
    timestamp: new Date().toISOString(),
    icon: 'mdi-login',
    color: 'success'
  },
  {
    id: 2,
    description: 'Updated profile information',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    icon: 'mdi-account-edit',
    color: 'info'
  },
  {
    id: 3,
    description: 'Changed password',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    icon: 'mdi-lock-reset',
    color: 'warning'
  }
])

// Methods
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleUpdateProfile = async () => {
  if (!props.user) return

  try {
    isLoading.value = true

    const result = await authStore.updateProfile({
      name: editForm.value.name,
      email: editForm.value.email
    })

    if (result.success) {
      showEditModal.value = false
      emit('updated', authStore.user!)
    } else {
      emit('error', result.error || 'Failed to update profile')
    }
  } catch (err: any) {
    console.error('Profile update error:', err)
    emit('error', err.message || 'An unexpected error occurred')
  } finally {
    isLoading.value = false
  }
}

const handleChangePassword = async () => {
  try {
    isLoading.value = true

    const result = await authStore.changePassword(
      passwordForm.value.currentPassword,
      passwordForm.value.newPassword
    )

    if (result.success) {
      showChangePasswordModal.value = false
      passwordForm.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      // Show success message
    } else {
      emit('error', result.error || 'Failed to change password')
    }
  } catch (err: any) {
    console.error('Password change error:', err)
    emit('error', err.message || 'An unexpected error occurred')
  } finally {
    isLoading.value = false
  }
}

// Watch for modal changes to reset forms
watch(showEditModal, (show) => {
  if (show && props.user) {
    editForm.value = {
      name: props.user.name,
      email: props.user.email
    }
  }
})

watch(showChangePasswordModal, (show) => {
  if (!show) {
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  }
})
</script>

<style scoped>
.user-profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 3rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.profile-avatar {
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
}

.profile-email {
  color: #64748b;
  font-size: 1rem;
  margin: 0 0 1rem 0;
}

.profile-roles {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.role-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.profile-actions {
  flex-shrink: 0;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-section {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1rem;
  color: #1a1a1a;
  font-weight: 500;
}

.roles-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
}

.role-header {
  margin-bottom: 1rem;
}

.role-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 0.25rem 0;
}

.role-description {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
}

.role-permissions h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.permissions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permission-badge {
  background: #f3f4f6;
  color: #374151;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.security-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
}

.activity-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-content {
  flex: 1;
}

.activity-description {
  font-size: 0.875rem;
  color: #1a1a1a;
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.activity-time {
  font-size: 0.75rem;
  color: #64748b;
}

@media (max-width: 768px) {
  .user-profile-container {
    padding: 1rem;
  }
  
  .profile-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
  
  .profile-actions {
    width: 100%;
  }
  
  .profile-actions .v-btn {
    width: 100%;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .security-actions {
    flex-direction: column;
  }
  
  .security-actions .v-btn {
    width: 100%;
  }
}
</style> 
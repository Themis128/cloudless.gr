<template>
  <v-container class="users-settings-page" fluid>
    <div class="page-header mb-6">
      <h1 class="text-h3 font-weight-bold primary--text mb-2">
        Settings
      </h1>
      <p class="text-subtitle-1">
        Manage your account preferences and application settings
      </p>
    </div>

    <v-row>
      <!-- Settings Navigation -->
      <v-col cols="12" md="3">
        <v-card class="settings-nav">
          <v-list nav>
            <v-list-item
              v-for="item in settingsItems"
              :key="item.id"
              :value="item.id"
              :active="activeSection === item.id"
              @click="activeSection = item.id"
            >
              <template #prepend>
                <v-icon>{{ item.icon }}</v-icon>
              </template>
              <v-list-item-title>{{ item.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Settings Content -->
      <v-col cols="12" md="9">
        <!-- Profile Settings -->
        <v-card v-show="activeSection === 'profile'" class="mb-6">
          <v-card-title>Profile Settings</v-card-title>
          <v-card-text>
            <v-form ref="profileForm">              <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="profileSettings.full_name"
                  label="Full Name"
                  variant="outlined"
                  :rules="nameRules"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="profileSettings.email"
                  label="Email"
                  type="email"
                  variant="outlined"
                  :rules="emailRules"
                  readonly
                />
                <div class="text-caption text-grey mt-1">
                  Contact support to change your email address
                </div>
              </v-col>                <v-col cols="12">
                <v-alert type="info" variant="tonal" class="mb-4">
                  Additional profile fields (bio, company, job title) are not yet available in the current backend implementation.
                </v-alert>
              </v-col>
            </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              :loading="saving.profile"
              @click="saveProfileSettings"
            >
              Save Changes
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Account Security -->
        <v-card v-show="activeSection === 'security'" class="mb-6">
          <v-card-title>Account Security</v-card-title>
          <v-card-text>
            <v-form ref="securityForm">
              <h3 class="text-h6 mb-4">Change Password</h3>
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="securitySettings.currentPassword"
                    label="Current Password"
                    type="password"
                    variant="outlined"
                    :rules="passwordRules"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="securitySettings.newPassword"
                    label="New Password"
                    type="password"
                    variant="outlined"
                    :rules="newPasswordRules"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="securitySettings.confirmPassword"
                    label="Confirm Password"
                    type="password"
                    variant="outlined"
                    :rules="confirmPasswordRules"
                  />
                </v-col>
              </v-row>

              <v-divider class="my-6" />

              <h3 class="text-h6 mb-4">Two-Factor Authentication</h3>
              <v-row align="center">
                <v-col>
                  <div class="d-flex align-center">
                    <v-switch
                      v-model="securitySettings.twoFactorEnabled"
                      color="primary"
                      :loading="saving.twoFactor"
                      @change="toggleTwoFactor"
                    />
                    <div class="ml-3">
                      <div class="font-weight-medium">
                        Two-Factor Authentication
                      </div>
                      <div class="text-caption text-grey">
                        Add an extra layer of security to your account
                      </div>
                    </div>
                  </div>
                </v-col>
              </v-row>

              <v-divider class="my-6" />

              <h3 class="text-h6 mb-4">Active Sessions</h3>
              <v-list>
                <v-list-item
                  v-for="session in activeSessions"
                  :key="session.id"
                  class="px-0"
                >
                  <template #prepend>
                    <v-icon>{{ getDeviceIcon(session.device) }}</v-icon>
                  </template>
                  <v-list-item-title>{{ session.device }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ session.location }} • Last active {{ formatDate(session.lastActive) }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-chip
                      v-if="session.current"
                      color="success"
                      size="small"
                      variant="flat"
                    >
                      Current
                    </v-chip>
                    <v-btn
                      v-else
                      variant="text"
                      color="error"
                      size="small"
                      @click="revokeSession(session.id)"
                    >
                      Revoke
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              :loading="saving.security"
              @click="saveSecuritySettings"
            >
              Update Password
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Notifications -->
        <v-card v-show="activeSection === 'notifications'" class="mb-6">
          <v-card-title>Notification Preferences</v-card-title>
          <v-card-text>
            <div v-for="category in notificationCategories" :key="category.id" class="mb-6">
              <h3 class="text-h6 mb-3">{{ category.title }}</h3>
              <div v-for="setting in category.settings" :key="setting.id" class="mb-3">
                <v-row align="center">
                  <v-col>
                    <div class="font-weight-medium">{{ setting.title }}</div>
                    <div class="text-caption text-grey">{{ setting.description }}</div>
                  </v-col>
                  <v-col cols="auto">
                    <v-switch
                      v-model="notificationSettings[setting.id]"
                      color="primary"
                      @change="saveNotificationSettings"
                    />
                  </v-col>
                </v-row>
              </div>
              <v-divider v-if="category.id !== notificationCategories[notificationCategories.length - 1].id" />
            </div>
          </v-card-text>
        </v-card>

        <!-- Preferences -->
        <v-card v-show="activeSection === 'preferences'" class="mb-6">
          <v-card-title>Application Preferences</v-card-title>
          <v-card-text>
            <v-form ref="preferencesForm">
              <h3 class="text-h6 mb-4">Display</h3>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="preferences.theme"
                    :items="themeOptions"
                    label="Theme"
                    variant="outlined"
                    @update:model-value="savePreferences"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="preferences.language"
                    :items="languageOptions"
                    label="Language"
                    variant="outlined"
                    @update:model-value="savePreferences"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="preferences.timezone"
                    :items="timezoneOptions"
                    label="Timezone"
                    variant="outlined"
                    @update:model-value="savePreferences"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="preferences.dateFormat"
                    :items="dateFormatOptions"
                    label="Date Format"
                    variant="outlined"
                    @update:model-value="savePreferences"
                  />
                </v-col>
              </v-row>

              <v-divider class="my-6" />

              <h3 class="text-h6 mb-4">Workspace</h3>
              <v-row>
                <v-col cols="12">
                  <div class="d-flex align-center mb-3">
                    <v-switch
                      v-model="preferences.autoSave"
                      color="primary"
                      @change="savePreferences"
                    />
                    <div class="ml-3">
                      <div class="font-weight-medium">Auto-save projects</div>
                      <div class="text-caption text-grey">
                        Automatically save changes every few minutes
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12">
                  <div class="d-flex align-center mb-3">
                    <v-switch
                      v-model="preferences.showWelcome"
                      color="primary"
                      @change="savePreferences"
                    />
                    <div class="ml-3">
                      <div class="font-weight-medium">Show welcome screen</div>
                      <div class="text-caption text-grey">
                        Display welcome screen on app startup
                      </div>
                    </div>
                  </div>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Privacy -->
        <v-card v-show="activeSection === 'privacy'" class="mb-6">
          <v-card-title>Privacy Settings</v-card-title>
          <v-card-text>
            <div class="mb-6">
              <h3 class="text-h6 mb-3">Data & Analytics</h3>
              <div class="d-flex align-center mb-3">
                <v-switch
                  v-model="privacySettings.allowAnalytics"
                  color="primary"
                  @change="savePrivacySettings"
                />
                <div class="ml-3">
                  <div class="font-weight-medium">Usage Analytics</div>
                  <div class="text-caption text-grey">
                    Help improve our service by sharing anonymous usage data
                  </div>
                </div>
              </div>
              <div class="d-flex align-center mb-3">
                <v-switch
                  v-model="privacySettings.allowCrashReports"
                  color="primary"
                  @change="savePrivacySettings"
                />
                <div class="ml-3">
                  <div class="font-weight-medium">Crash Reports</div>
                  <div class="text-caption text-grey">
                    Automatically send crash reports to help us fix issues
                  </div>
                </div>
              </div>
            </div>

            <v-divider class="my-6" />

            <div class="mb-6">
              <h3 class="text-h6 mb-3">Profile Visibility</h3>
              <v-radio-group v-model="privacySettings.profileVisibility" @update:model-value="savePrivacySettings">
                <v-radio value="public" label="Public - Anyone can see your profile" />
                <v-radio value="private" label="Private - Only you can see your profile" />
                <v-radio value="limited" label="Limited - Only team members can see your profile" />
              </v-radio-group>
            </div>

            <v-divider class="my-6" />

            <div>
              <h3 class="text-h6 mb-3 text-error">Danger Zone</h3>
              <v-alert
                type="warning"
                variant="tonal"
                class="mb-4"
              >
                <div class="font-weight-medium">Delete Account</div>
                <div class="text-body-2 mt-1">
                  This action cannot be undone. All your data will be permanently deleted.
                </div>
              </v-alert>
              <v-btn
                color="error"
                variant="outlined"
                @click="deleteAccountDialog = true"
              >
                Delete Account
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delete Account Dialog -->
    <v-dialog v-model="deleteAccountDialog" max-width="500">
      <v-card>
        <v-card-title class="text-error">Delete Account</v-card-title>
        <v-card-text>
          <v-alert type="error" variant="tonal" class="mb-4">
            This action cannot be undone. All your projects, data, and settings will be permanently deleted.
          </v-alert>
          <p class="mb-4">
            Type <strong>DELETE</strong> to confirm account deletion:
          </p>
          <v-text-field
            v-model="deleteConfirmation"
            label="Type DELETE to confirm"
            variant="outlined"
            :rules="deleteRules"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteAccountDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :disabled="deleteConfirmation !== 'DELETE'"
            :loading="deleting"
            @click="confirmDeleteAccount"
          >
            Delete Account
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

definePageMeta({
  layout: 'user',
})

// Import stores  
const userStore = useUserStore()

// State
const activeSection = ref('profile')
const deleteAccountDialog = ref(false)
const deleteConfirmation = ref('')
const deleting = ref(false)

const saving = reactive({
  profile: false,
  security: false,
  twoFactor: false
})

// Settings data - aligned with backend schema (limited fields available)
const profileSettings = reactive({
  full_name: '',
  email: ''
  // Note: bio, company, jobTitle not available in current backend interface
})

const securitySettings = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  twoFactorEnabled: false
})

const notificationSettings = reactive<Record<string, boolean>>({
  projectUpdates: true,
  teamInvites: true,
  systemNotifications: true,
  marketingEmails: false,
  weeklyDigest: true,
  securityAlerts: true
})

const preferences = reactive({
  theme: 'auto',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  autoSave: true,
  showWelcome: true
})

const privacySettings = reactive({
  allowAnalytics: true,
  allowCrashReports: true,
  profileVisibility: 'public'
})

// Settings navigation
const settingsItems = [
  { id: 'profile', title: 'Profile', icon: 'mdi-account' },
  { id: 'security', title: 'Security', icon: 'mdi-shield-check' },
  { id: 'notifications', title: 'Notifications', icon: 'mdi-bell' },
  { id: 'preferences', title: 'Preferences', icon: 'mdi-cog' },
  { id: 'privacy', title: 'Privacy', icon: 'mdi-eye' }
]

// Notification categories
const notificationCategories = [
  {
    id: 'projects',
    title: 'Projects',
    settings: [
      {
        id: 'projectUpdates',
        title: 'Project Updates',
        description: 'Notifications when projects are modified'
      },
      {
        id: 'teamInvites',
        title: 'Team Invitations',
        description: 'When you are invited to join a team'
      }
    ]
  },
  {
    id: 'system',
    title: 'System',
    settings: [
      {
        id: 'systemNotifications',
        title: 'System Notifications',
        description: 'Important system updates and maintenance'
      },
      {
        id: 'securityAlerts',
        title: 'Security Alerts',
        description: 'Notifications about account security'
      }
    ]
  },
  {
    id: 'marketing',
    title: 'Marketing',
    settings: [
      {
        id: 'marketingEmails',
        title: 'Marketing Emails',
        description: 'Product updates and feature announcements'
      },
      {
        id: 'weeklyDigest',
        title: 'Weekly Digest',
        description: 'Weekly summary of your activity'
      }
    ]
  }
]

// Options
const themeOptions = [
  { title: 'Auto', value: 'auto' },
  { title: 'Light', value: 'light' },
  { title: 'Dark', value: 'dark' }
]

const languageOptions = [
  { title: 'English', value: 'en' },
  { title: 'Spanish', value: 'es' },
  { title: 'French', value: 'fr' },
  { title: 'German', value: 'de' }
]

const timezoneOptions = [
  { title: 'UTC', value: 'UTC' },
  { title: 'Eastern Time (ET)', value: 'America/New_York' },
  { title: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { title: 'Central European Time (CET)', value: 'Europe/Paris' }
]

const dateFormatOptions = [
  { title: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { title: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { title: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
]

// Mock active sessions
const activeSessions = ref([
  {
    id: '1',
    device: 'Chrome on Windows',
    location: 'New York, US',
    lastActive: '2024-01-20T10:30:00Z',
    current: true
  },
  {
    id: '2',
    device: 'Safari on iPhone',
    location: 'New York, US',
    lastActive: '2024-01-19T08:15:00Z',
    current: false
  }
])

// Validation rules
const nameRules = [
  (v: string) => !!v || 'This field is required',
  (v: string) => v.length >= 2 || 'Must be at least 2 characters'
]

const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid'
]

// Bio rules removed - bio field not available in current backend

const passwordRules = [
  (v: string) => !!v || 'Password is required'
]

const newPasswordRules = [
  (v: string) => !!v || 'New password is required',
  (v: string) => v.length >= 8 || 'Password must be at least 8 characters'
]

const confirmPasswordRules = [
  (v: string) => !!v || 'Please confirm your password',
  (v: string) => v === securitySettings.newPassword || 'Passwords do not match'
]

const deleteRules = [
  (v: string) => v === 'DELETE' || 'Type DELETE to confirm'
]

// Methods
const loadSettings = async () => {
  // Load from user store which gets data from auth store
  await userStore.initialize()
  
  const profile = userStore.profile
  if (profile) {
    Object.assign(profileSettings, {
      full_name: profile.full_name || '',
      email: profile.email || ''
    })
  }
}

const saveProfileSettings = async () => {
  saving.profile = true
  try {
    const { useRobustAuth } = await import('~/composables/useRobustAuth')
    const { updateProfile } = useRobustAuth()
    
    const result = await updateProfile({
      full_name: profileSettings.full_name
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update profile')
    }
    
    console.log('Profile settings saved successfully')
  } catch (error) {
    console.error('Error saving profile settings:', error)
  } finally {
    saving.profile = false
  }
}

const saveSecuritySettings = async () => {
  saving.security = true
  try {
    if (!securitySettings.currentPassword || !securitySettings.newPassword) {
      throw new Error('Current password and new password are required')
    }
    
    if (securitySettings.newPassword !== securitySettings.confirmPassword) {
      throw new Error('New password and confirmation do not match')
    }
    
    const userStore = useUserStore()
    const result = await userStore.changePassword(
      securitySettings.currentPassword,
      securitySettings.newPassword
    )
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to change password')
    }
    
    console.log('Password changed successfully')
    // Clear password fields
    securitySettings.currentPassword = ''
    securitySettings.newPassword = ''
    securitySettings.confirmPassword = ''
  } catch (error) {
    console.error('Error changing password:', error)
  } finally {
    saving.security = false
  }
}

const toggleTwoFactor = async () => {
  saving.twoFactor = true
  try {
    // Mock toggle - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Two-factor authentication:', securitySettings.twoFactorEnabled ? 'enabled' : 'disabled')
  } catch (error) {
    console.error('Error toggling two-factor authentication:', error)
    // Revert on error
    securitySettings.twoFactorEnabled = !securitySettings.twoFactorEnabled
  } finally {
    saving.twoFactor = false
  }
}

const saveNotificationSettings = async () => {
  try {
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('Notification settings saved:', notificationSettings)
  } catch (error) {
    console.error('Error saving notification settings:', error)
  }
}

const savePreferences = async () => {
  try {
    // Map frontend preferences to backend interface
    const backendPreferences = {
      theme: preferences.theme as 'light' | 'dark' | 'auto',
      language: preferences.language,
      timezone: preferences.timezone,
      notifications: true // Frontend has more complex notification settings
    }
    
    await userStore.updatePreferences(backendPreferences)
    console.log('Preferences saved successfully')
  } catch (error) {
    console.error('Error saving preferences:', error)
  }
}

const savePrivacySettings = async () => {
  try {
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('Privacy settings saved:', privacySettings)
  } catch (error) {
    console.error('Error saving privacy settings:', error)
  }
}

const revokeSession = async (sessionId: string) => {
  try {
    // Mock revoke - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500))
    activeSessions.value = activeSessions.value.filter(s => s.id !== sessionId)
    console.log('Session revoked:', sessionId)
  } catch (error) {
    console.error('Error revoking session:', error)
  }
}

const confirmDeleteAccount = async () => {
  deleting.value = true
  try {
    // Mock delete - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('Account deleted')
    // Redirect to goodbye page or logout
  } catch (error) {
    console.error('Error deleting account:', error)
  } finally {
    deleting.value = false
  }
}

const getDeviceIcon = (device: string) => {
  if (device.includes('iPhone') || device.includes('Android')) {
    return 'mdi-cellphone'
  } else if (device.includes('iPad') || device.includes('Tablet')) {
    return 'mdi-tablet'
  } else {
    return 'mdi-laptop'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.users-settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-nav {
  position: sticky;
  top: 80px;
}

.settings-nav .v-list-item {
  border-radius: 8px;
  margin: 2px 8px;
}

.settings-nav .v-list-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

/* Mobile responsiveness for settings page */
@media (max-width: 768px) {
  .settings-nav {
    position: static;
    top: auto;
    margin-bottom: 1rem;
  }
  
  .settings-nav .v-list {
    background: transparent;
  }
  
  .settings-nav .v-list-item {
    padding: 12px 16px;
    margin: 1px 4px;
  }
}

@media (max-width: 480px) {
  .users-settings-page {
    padding: 8px;
  }
  
  .settings-nav .v-list-item {
    padding: 10px 12px;
    font-size: 0.9rem;
  }
  
  .settings-nav .v-list-item .v-icon {
    font-size: 1.1rem;
  }
  
  /* Make forms more mobile-friendly */
  :deep(.v-text-field .v-field__input) {
    min-height: 48px;
  }
  
  :deep(.v-btn) {
    min-height: 44px;
    font-size: 0.9rem;
  }
  
  :deep(.v-card-title) {
    font-size: 1.3rem !important;
    padding: 12px 16px;
  }
  
  :deep(.v-card-text) {
    padding: 12px 16px;
  }
  
  :deep(.v-card-actions) {
    padding: 8px 16px;
  }
}

@media (max-width: 360px) {
  .users-settings-page {
    padding: 4px;
  }
  
  :deep(.v-card-title) {
    font-size: 1.2rem !important;
    padding: 10px 12px;
  }
  
  :deep(.v-card-text) {
    padding: 10px 12px;
  }
}
</style>

<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-shield-account</v-icon>
            Security Settings
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-6">
            <!-- Password Change Section -->
            <div class="mb-8">
              <h3 class="text-h6 font-weight-bold mb-4">
                <v-icon class="mr-2">mdi-lock</v-icon>
                Change Password
              </h3>
              <v-form ref="passwordForm" @submit.prevent="changePassword">
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="passwordData.currentPassword"
                      label="Current Password"
                      type="password"
                      variant="outlined"
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-lock"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="passwordData.newPassword"
                      label="New Password"
                      type="password"
                      variant="outlined"
                      :rules="[rules.required, rules.minLength(8)]"
                      prepend-inner-icon="mdi-lock-plus"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="passwordData.confirmPassword"
                      label="Confirm New Password"
                      type="password"
                      variant="outlined"
                      :rules="[rules.required, rules.passwordMatch]"
                      prepend-inner-icon="mdi-lock-check"
                    />
                  </v-col>
                </v-row>
                <v-btn
                  type="submit"
                  color="primary"
                  variant="flat"
                  :loading="passwordLoading"
                  class="mt-2"
                >
                  <v-icon start>mdi-content-save</v-icon>
                  Update Password
                </v-btn>
              </v-form>
            </div>

            <v-divider class="my-6" />

            <!-- Two-Factor Authentication -->
            <div class="mb-8">
              <h3 class="text-h6 font-weight-bold mb-4">
                <v-icon class="mr-2">mdi-two-factor-authentication</v-icon>
                Two-Factor Authentication
              </h3>
              <div class="d-flex align-center mb-4">
                <v-icon
                  :color="twoFactorEnabled ? 'success' : 'grey'"
                  class="mr-3"
                  size="24"
                >
                  {{ twoFactorEnabled ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                </v-icon>
                <div>
                  <div class="font-weight-medium">
                    Two-Factor Authentication {{ twoFactorEnabled ? 'Enabled' : 'Disabled' }}
                  </div>
                  <div class="text-body-2 text-grey-darken-1">
                    {{ twoFactorEnabled
                      ? 'Your account is protected with 2FA'
                      : 'Add an extra layer of security to your account'
                    }}
                  </div>
                </div>
              </div>
              <v-btn
                :color="twoFactorEnabled ? 'error' : 'success'"
                variant="outlined"
                :loading="twoFactorLoading"
                @click="toggleTwoFactor"
              >
                <v-icon start>
                  {{ twoFactorEnabled ? 'mdi-shield-off' : 'mdi-shield-check' }}
                </v-icon>
                {{ twoFactorEnabled ? 'Disable' : 'Enable' }} 2FA
              </v-btn>
            </div>

            <v-divider class="my-6" />

            <!-- Active Sessions -->
            <div class="mb-8">
              <h3 class="text-h6 font-weight-bold mb-4">
                <v-icon class="mr-2">mdi-devices</v-icon>
                Active Sessions
              </h3>
              <div v-if="loadingSessions" class="text-center py-4">
                <v-progress-circular indeterminate color="primary" size="32" />
                <p class="mt-2">Loading sessions...</p>
              </div>
              <div v-else>
                <v-list class="pa-0">
                  <v-list-item
                    v-for="session in activeSessions"
                    :key="session.id"
                    class="px-0"
                  >
                    <template #prepend>
                      <v-icon :color="session.current ? 'success' : 'grey'">
                        {{ getDeviceIcon(session.device_type) }}
                      </v-icon>
                    </template>

                    <v-list-item-title class="font-weight-medium">
                      {{ session.device_name || 'Unknown Device' }}
                      <v-chip
                        v-if="session.current"
                        color="success"
                        size="x-small"
                        class="ml-2"
                      >
                        Current
                      </v-chip>
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ session.location || 'Unknown Location' }} •
                      Last active {{ formatDate(session.last_active) }}
                    </v-list-item-subtitle>

                    <template #append>
                      <v-btn
                        v-if="!session.current"
                        icon
                        size="small"
                        variant="text"
                        color="error"
                        @click="revokeSession(session.id)"
                      >
                        <v-icon>mdi-close</v-icon>
                      </v-btn>
                    </template>
                  </v-list-item>
                </v-list>
                <v-btn
                  v-if="activeSessions.length > 1"
                  variant="outlined"
                  color="error"
                  class="mt-4"
                  :loading="revokingAll"
                  @click="revokeAllSessions"
                >
                  <v-icon start>mdi-logout-variant</v-icon>
                  Sign Out All Other Devices
                </v-btn>
              </div>
            </div>

            <v-divider class="my-6" />

            <!-- Recent Security Activity -->
            <div class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-4">
                <v-icon class="mr-2">mdi-shield-alert</v-icon>
                Recent Security Activity
              </h3>
              <v-list class="pa-0">
                <v-list-item
                  v-for="activity in securityActivity.slice(0, 5)"
                  :key="activity.id"
                  class="px-0"
                >
                  <template #prepend>
                    <v-icon :color="getActivityColor(activity.type)">
                      {{ getActivityIcon(activity.type) }}
                    </v-icon>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ activity.description }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDateTime(activity.created_at) }} • {{ activity.ip_address }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
              <v-btn
                variant="text"
                size="small"
                @click="$router.push('/users/activity')"
              >
                View All Activity
                <v-icon end>mdi-chevron-right</v-icon>
              </v-btn>
            </div>

            <!-- Success/Error Messages -->
            <v-alert
              v-if="success"
              type="success"
              class="mt-4"
              closable
              @click:close="success = null"
            >
              {{ success }}
            </v-alert>

            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              closable
              @click:close="error = null"
            >
              {{ error }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
const { user: _user } = useSupabaseAuth()
const supabase = useSupabaseClient()

// Reactive data
const passwordForm = ref(null)
const passwordLoading = ref(false)
const twoFactorLoading = ref(false)
const loadingSessions = ref(false)
const revokingAll = ref(false)
const success = ref(null)
const error = ref(null)

// Form data
const passwordData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Security state
const twoFactorEnabled = ref(false)
const activeSessions = ref([])
const securityActivity = ref([])

// Validation rules
const rules = {
  required: (value) => !!value || 'This field is required',
  minLength: (min) => (value) => !value || value.length >= min || `Minimum ${min} characters required`,
  passwordMatch: (value) => value === passwordData.newPassword || 'Passwords must match'
}

// Methods
const changePassword = async () => {
  const { valid } = await passwordForm.value.validate()
  if (!valid) return

  passwordLoading.value = true
  error.value = null
  success.value = null

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordData.newPassword
    })

    if (updateError) throw updateError

    success.value = 'Password updated successfully!'

    // Reset form
    Object.assign(passwordData, {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  } catch (err) {
    console.error('Password update error:', err)
    error.value = 'Failed to update password. Please check your current password and try again.'
  } finally {
    passwordLoading.value = false
  }
}

const toggleTwoFactor = async () => {
  twoFactorLoading.value = true
  error.value = null

  try {
    // In a real app, this would integrate with an authenticator app
    // For now, we'll just toggle the state
    twoFactorEnabled.value = !twoFactorEnabled.value

    success.value = twoFactorEnabled.value
      ? 'Two-factor authentication enabled successfully!'
      : 'Two-factor authentication disabled.'
  } catch (err) {
    console.error('2FA toggle error:', err)
    error.value = 'Failed to update two-factor authentication settings.'
  } finally {
    twoFactorLoading.value = false
  }
}

const loadActiveSessions = async () => {
  loadingSessions.value = true

  try {
    // Mock data for demonstration
    activeSessions.value = [
      {
        id: 1,
        device_name: 'Chrome on Windows',
        device_type: 'desktop',
        location: 'Athens, Greece',
        last_active: new Date(),
        current: true
      },
      {
        id: 2,
        device_name: 'Safari on iPhone',
        device_type: 'mobile',
        location: 'Athens, Greece',
        last_active: new Date(Date.now() - 3600000),
        current: false
      }
    ]
  } catch (err) {
    console.error('Error loading sessions:', err)
  } finally {
    loadingSessions.value = false
  }
}

const revokeSession = async (sessionId) => {
  try {
    // In a real app, this would revoke the specific session
    activeSessions.value = activeSessions.value.filter(s => s.id !== sessionId)
    success.value = 'Session revoked successfully!'
  } catch (err) {
    console.error('Error revoking session:', err)
    error.value = 'Failed to revoke session.'
  }
}

const revokeAllSessions = async () => {
  revokingAll.value = true

  try {
    // In a real app, this would revoke all other sessions
    activeSessions.value = activeSessions.value.filter(s => s.current)
    success.value = 'All other sessions have been signed out!'
  } catch (err) {
    console.error('Error revoking sessions:', err)
    error.value = 'Failed to sign out other devices.'
  } finally {
    revokingAll.value = false
  }
}

const loadSecurityActivity = () => {
  // Mock data for demonstration
  securityActivity.value = [
    {
      id: 1,
      type: 'login',
      description: 'Successful sign in',
      created_at: new Date(),
      ip_address: '192.168.1.1'
    },
    {
      id: 2,
      type: 'password_change',
      description: 'Password changed',
      created_at: new Date(Date.now() - 7200000),
      ip_address: '192.168.1.1'
    }
  ]
}

const getDeviceIcon = (deviceType) => {
  const icons = {
    desktop: 'mdi-desktop-classic',
    mobile: 'mdi-cellphone',
    tablet: 'mdi-tablet'
  }
  return icons[deviceType] || 'mdi-devices'
}

const getActivityColor = (type) => {
  const colors = {
    login: 'success',
    password_change: 'warning',
    failed_login: 'error',
    two_factor: 'info'
  }
  return colors[type] || 'grey'
}

const getActivityIcon = (type) => {
  const icons = {
    login: 'mdi-login',
    password_change: 'mdi-lock-reset',
    failed_login: 'mdi-alert-circle',
    two_factor: 'mdi-two-factor-authentication'
  }
  return icons[type] || 'mdi-shield'
}

const formatDate = (date) => {
  if (!date) return ''

  const now = new Date()
  const diff = now - new Date(date)

  if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  } else {
    return new Date(date).toLocaleDateString()
  }
}

const formatDateTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString()
}

// Lifecycle
onMounted(() => {
  loadActiveSessions()
  loadSecurityActivity()
})

// Page meta
definePageMeta({
  layout: 'user',
  middleware: 'auth',
  title: 'Security Settings'
})

// SEO
useSeoMeta({
  title: 'Security Settings - Cloudless.gr',
  description: 'Manage your account security settings and preferences'
})
</script>

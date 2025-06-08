<template>
  <v-container class="settings-page" fluid>
    <v-row>
      <v-col cols="12">
        <!-- Header -->
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <h1 class="text-h4 font-weight-bold mb-2">Settings</h1>
            <p class="text-body-1 text-medium-emphasis">Manage your account preferences and application settings</p>
          </div>
          <v-btn
            to="/profile"
            color="primary"
            variant="outlined"
            prepend-icon="mdi-account"
          >
            View Profile
          </v-btn>
        </div>

        <v-row>
          <!-- Main Settings Content -->
          <v-col cols="12" lg="8">
            <!-- Account Settings -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-account-cog</v-icon>
                Account Settings
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.emailNotifications"
                      label="Email Notifications"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-email</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Receive email notifications about account activity
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.pushNotifications"
                      label="Push Notifications"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-bell</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Receive browser push notifications
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.marketingEmails"
                      label="Marketing Emails"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-bullhorn</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Receive updates about new features and products
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.weeklyDigest"
                      label="Weekly Digest"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-email-newsletter</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Receive weekly summary of your activity
                    </p>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- Privacy Settings -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-shield-account</v-icon>
                Privacy & Security
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.profileVisibility"
                      label="Public Profile"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-eye</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Make your profile visible to other users
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.activityTracking"
                      label="Activity Tracking"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-chart-line</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Allow tracking for analytics and insights
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.dataCollection"
                      label="Data Collection"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-database</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Allow collection of usage data for improvements
                    </p>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="settings.autoSave"
                      label="Auto-save Projects"
                      color="primary"
                      hide-details
                    >
                      <template #prepend>
                        <v-icon>mdi-content-save-auto</v-icon>
                      </template>
                    </v-switch>
                    <p class="text-caption text-medium-emphasis mt-1">
                      Automatically save project changes
                    </p>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- Application Preferences -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-cog</v-icon>
                Application Preferences
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="settings.language"
                      :items="languageOptions"
                      label="Language"
                      variant="outlined"
                      prepend-inner-icon="mdi-translate"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="settings.timezone"
                      :items="timezoneOptions"
                      label="Timezone"
                      variant="outlined"
                      prepend-inner-icon="mdi-clock"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="settings.dateFormat"
                      :items="dateFormatOptions"
                      label="Date Format"
                      variant="outlined"
                      prepend-inner-icon="mdi-calendar"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="settings.itemsPerPage"
                      :items="itemsPerPageOptions"
                      label="Items per Page"
                      variant="outlined"
                      prepend-inner-icon="mdi-format-list-numbered"
                      hide-details
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- API & Integrations -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-api</v-icon>
                API & Integrations
              </v-card-title>
              <v-card-text>
                <div class="mb-4">
                  <h3 class="text-h6 mb-2">API Keys</h3>
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    Manage your API keys for external integrations
                  </p>
                  
                  <v-card variant="outlined" class="mb-4">
                    <v-card-text>
                      <div class="d-flex align-center justify-space-between">
                        <div>
                          <p class="text-body-1 font-weight-medium">Personal API Key</p>
                          <p class="text-body-2 text-medium-emphasis">
                            Created on {{ formatDate(new Date()) }}
                          </p>
                        </div>
                        <div class="d-flex align-center gap-2">
                          <v-chip color="success" size="small" variant="tonal">Active</v-chip>
                          <v-btn icon="mdi-content-copy" variant="text" size="small" @click="copyApiKey" />
                          <v-btn icon="mdi-refresh" variant="text" size="small" @click="regenerateApiKey" />
                          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="revokeApiKey" />
                        </div>
                      </div>
                      <v-text-field
                        :value="maskedApiKey"
                        readonly
                        variant="outlined"
                        class="mt-3"
                        density="compact"
                        hide-details
                      />
                    </v-card-text>
                  </v-card>
                  
                  <v-btn color="primary" variant="outlined" prepend-icon="mdi-plus">
                    Generate New API Key
                  </v-btn>
                </div>
                
                <v-divider class="my-4" />
                
                <div>
                  <h3 class="text-h6 mb-2">Webhooks</h3>
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    Configure webhooks for real-time notifications
                  </p>
                  
                  <v-btn color="primary" variant="outlined" prepend-icon="mdi-webhook">
                    Manage Webhooks
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Sidebar -->
          <v-col cols="12" lg="4">
            <!-- Quick Actions -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-flash</v-icon>
                Quick Actions
              </v-card-title>
              <v-card-text>
                <div class="d-grid gap-3">
                  <v-btn
                    color="primary"
                    variant="outlined"
                    block
                    prepend-icon="mdi-lock-reset"
                    @click="changePassword"
                  >
                    Change Password
                  </v-btn>
                  
                  <v-btn
                    color="warning"
                    variant="outlined"
                    block
                    prepend-icon="mdi-two-factor-authentication"
                    @click="manageTwoFactor"
                  >
                    2FA Settings
                  </v-btn>
                  
                  <v-btn
                    color="info"
                    variant="outlined"
                    block
                    prepend-icon="mdi-devices"
                    @click="viewSessions"
                  >
                    Active Sessions
                  </v-btn>
                  
                  <v-btn
                    color="success"
                    variant="outlined"
                    block
                    prepend-icon="mdi-download"
                    @click="downloadData"
                  >
                    Download Data
                  </v-btn>
                  
                  <v-btn
                    color="error"
                    variant="outlined"
                    block
                    prepend-icon="mdi-delete-forever"
                    @click="deleteAccount"
                  >
                    Delete Account
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>

            <!-- Save Settings -->
            <v-card elevation="2" class="mb-6">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-content-save</v-icon>
                Save Changes
              </v-card-title>
              <v-card-text>
                <v-btn
                  color="primary"
                  block
                  size="large"
                  :loading="saving"
                  @click="saveSettings"
                  prepend-icon="mdi-content-save"
                >
                  Save All Settings
                </v-btn>
                <p class="text-caption text-medium-emphasis mt-2 text-center">
                  Last saved: {{ lastSaved ? formatDate(lastSaved) : 'Never' }}
                </p>
              </v-card-text>
            </v-card>

            <!-- Import/Export -->
            <v-card elevation="2">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-swap-horizontal</v-icon>
                Import/Export
              </v-card-title>
              <v-card-text>
                <div class="d-grid gap-3">
                  <v-btn
                    color="success"
                    variant="outlined"
                    block
                    prepend-icon="mdi-export"
                    @click="exportSettings"
                  >
                    Export Settings
                  </v-btn>
                  
                  <v-btn
                    color="info"
                    variant="outlined"
                    block
                    prepend-icon="mdi-import"
                    @click="importSettings"
                  >
                    Import Settings
                  </v-btn>
                  
                  <v-btn
                    color="warning"
                    variant="outlined"
                    block
                    prepend-icon="mdi-restore"
                    @click="resetSettings"
                  >
                    Reset to Defaults
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSuccess"
      color="success"
      timeout="3000"
    >
      {{ successMessage }}
      <template #actions>
        <v-btn variant="text" @click="showSuccess = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Error Snackbar -->
    <v-snackbar
      v-model="showError"
      color="error"
      timeout="5000"
    >
      {{ errorMessage }}
      <template #actions>
        <v-btn variant="text" @click="showError = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

// Meta and page setup
definePageMeta({
  middleware: 'auth',
  layout: 'default'
})

// Composables
const { user } = useAuth()

// Reactive state
const loading = ref(false)
const showSuccess = ref(false)
const showError = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const lastSaved = ref<Date | null>(null)

// Settings object with all form data
const settings = reactive({
  // Account Settings
  emailNotifications: true,
  pushNotifications: false,
  marketingEmails: false,
  weeklyDigest: true,
  
  // Privacy & Security
  profileVisibility: 'public',
  activityTracking: true,
  dataCollection: false,
  autoSave: true,
  
  // Application Preferences
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  itemsPerPage: 25,
  
  // API & Integrations
  apiKey: 'sk-1234567890abcdef',
  webhookUrl: '',
  enableWebhooks: false
})

// Options for dropdowns (using underscore prefix to avoid unused variable warning)
const _profileVisibilityOptions = [
  { title: 'Public', value: 'public' },
  { title: 'Private', value: 'private' },
  { title: 'Friends Only', value: 'friends' }
]

const _languageOptions = [
  { title: 'English', value: 'en' },
  { title: 'Spanish', value: 'es' },
  { title: 'French', value: 'fr' },
  { title: 'German', value: 'de' },
  { title: 'Italian', value: 'it' },
  { title: 'Portuguese', value: 'pt' },
  { title: 'Russian', value: 'ru' },
  { title: 'Chinese', value: 'zh' },
  { title: 'Japanese', value: 'ja' }
]

const _timezoneOptions = [
  { title: 'UTC', value: 'UTC' },
  { title: 'Eastern Time (ET)', value: 'America/New_York' },
  { title: 'Central Time (CT)', value: 'America/Chicago' },
  { title: 'Mountain Time (MT)', value: 'America/Denver' },
  { title: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { title: 'London (GMT)', value: 'Europe/London' },
  { title: 'Paris (CET)', value: 'Europe/Paris' },
  { title: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { title: 'Sydney (AEST)', value: 'Australia/Sydney' }
]

const _dateFormatOptions = [
  { title: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { title: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { title: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { title: 'DD MMM YYYY', value: 'DD MMM YYYY' }
]

const _itemsPerPageOptions = [
  { title: '10', value: 10 },
  { title: '25', value: 25 },
  { title: '50', value: 50 },
  { title: '100', value: 100 }
]

// Computed properties
const _formattedLastSaved = computed(() => {
  if (!lastSaved.value) return 'Never'
  return lastSaved.value.toLocaleString()
})

const maskedApiKey = computed(() => {
  if (!settings.apiKey) return ''
  return settings.apiKey.substring(0, 8) + '...' + settings.apiKey.substring(settings.apiKey.length - 4)
})

// Methods
const saveSettings = async () => {
  loading.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real app, this would be an API call
    // await $fetch('/api/settings', {
    //   method: 'POST',
    //   body: settings
    // })
    
    lastSaved.value = new Date()
    showSuccessMessage('Settings saved successfully!')
  } catch (error) {
    console.error('Error saving settings:', error)
    showErrorMessage('Failed to save settings. Please try again.')
  } finally {
    loading.value = false
  }
}

const exportSettings = () => {
  try {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `settings-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    showSuccessMessage('Settings exported successfully!')
  } catch (error) {
    console.error('Error exporting settings:', error)
    showErrorMessage('Failed to export settings.')
  }
}

const importSettings = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const importedSettings = JSON.parse(e.target?.result as string)
      Object.assign(settings, importedSettings)
      showSuccessMessage('Settings imported successfully!')
    } catch (error) {
      console.error('Error importing settings:', error)
      showErrorMessage('Invalid settings file format.')
    }
  }
  reader.readAsText(file)
}

const resetSettings = () => {
  if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
    Object.assign(settings, {
      emailNotifications: true,
      pushNotifications: false,
      marketingEmails: false,
      weeklyDigest: true,
      profileVisibility: 'public',
      activityTracking: true,
      dataCollection: false,
      autoSave: true,
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      itemsPerPage: 25,
      apiKey: 'sk-1234567890abcdef',
      webhookUrl: '',
      enableWebhooks: false
    })
    showSuccessMessage('Settings reset to defaults!')
  }
}

const copyApiKey = async () => {
  try {
    await navigator.clipboard.writeText(settings.apiKey)
    showSuccessMessage('API key copied to clipboard!')
  } catch (error) {
    console.error('Error copying API key:', error)
    showErrorMessage('Failed to copy API key.')
  }
}

const regenerateApiKey = () => {
  if (confirm('Are you sure you want to regenerate your API key? This will invalidate the current key.')) {
    settings.apiKey = 'sk-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    showSuccessMessage('API key regenerated successfully!')
  }
}

const revokeApiKey = () => {
  if (confirm('Are you sure you want to revoke your API key? This will disable all API access.')) {
    settings.apiKey = ''
    showSuccessMessage('API key revoked successfully!')
  }
}

// Quick Actions (matching template function names)
const changePassword = () => {
  navigateTo('/settings/password')
}

const manageTwoFactor = () => {
  navigateTo('/settings/security')
}

const viewSessions = () => {
  navigateTo('/settings/sessions')
}

const downloadData = () => {
  showSuccessMessage('Data download request submitted. You will receive an email when ready.')
}

const deleteAccount = () => {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    // This would redirect to a deletion confirmation page
    navigateTo('/settings/delete-account')
  }
}

// Utility functions
const showSuccessMessage = (message: string) => {
  successMessage.value = message
  showSuccess.value = true
}

const showErrorMessage = (message: string) => {
  errorMessage.value = message
  showError.value = true
}

// Load settings on mount
onMounted(async () => {
  try {
    // In a real app, load settings from API
    // const userSettings = await $fetch('/api/settings')
    // Object.assign(settings, userSettings)
    
    // For demo, just show that settings are loaded
    console.log('Settings loaded for user:', user.value?.email)
  } catch (error) {
    console.error('Error loading settings:', error)
    showErrorMessage('Failed to load settings.')
  }
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.v-card-title {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
</style>

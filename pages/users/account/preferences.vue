<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-palette</v-icon>
            Preferences
          </v-card-title>

          <v-divider />

          <v-form @submit.prevent="savePreferences">
            <v-card-text class="pa-6">
              <!-- Theme Settings -->
              <div class="mb-6">
                <h3 class="text-h6 font-weight-bold mb-4">
                  <v-icon class="mr-2">mdi-theme-light-dark</v-icon>
                  Theme
                </h3>
                <v-radio-group v-model="preferences.theme" inline>
                  <v-radio label="Light" value="light" />
                  <v-radio label="Dark" value="dark" />
                  <v-radio label="System" value="system" />
                </v-radio-group>
              </div>

              <v-divider class="my-6" />

              <!-- Language Settings -->
              <div class="mb-6">
                <h3 class="text-h6 font-weight-bold mb-4">
                  <v-icon class="mr-2">mdi-translate</v-icon>
                  Language
                </h3>
                <v-select
                  v-model="preferences.language"
                  :items="languages"
                  item-title="name"
                  item-value="code"
                  variant="outlined"
                  prepend-inner-icon="mdi-web"
                />
              </div>

              <v-divider class="my-6" />

              <!-- Notification Settings -->
              <div class="mb-6">
                <h3 class="text-h6 font-weight-bold mb-4">
                  <v-icon class="mr-2">mdi-bell</v-icon>
                  Notifications
                </h3>
                <v-switch
                  v-model="preferences.emailNotifications"
                  label="Email notifications"
                  color="primary"
                  hide-details
                  class="mb-2"
                />
                <v-switch
                  v-model="preferences.pushNotifications"
                  label="Push notifications"
                  color="primary"
                  hide-details
                  class="mb-2"
                />
                <v-switch
                  v-model="preferences.projectUpdates"
                  label="Project update notifications"
                  color="primary"
                  hide-details
                  class="mb-2"
                />
                <v-switch
                  v-model="preferences.marketingEmails"
                  label="Marketing and promotional emails"
                  color="primary"
                  hide-details
                />
              </div>

              <v-divider class="my-6" />

              <!-- Privacy Settings -->
              <div class="mb-6">
                <h3 class="text-h6 font-weight-bold mb-4">
                  <v-icon class="mr-2">mdi-shield-account</v-icon>
                  Privacy
                </h3>
                <v-switch
                  v-model="preferences.profilePublic"
                  label="Make profile public"
                  color="primary"
                  hide-details
                  class="mb-2"
                />
                <v-switch
                  v-model="preferences.showActivity"
                  label="Show activity in profile"
                  color="primary"
                  hide-details
                  class="mb-2"
                />
                <v-switch
                  v-model="preferences.allowContact"
                  label="Allow others to contact me"
                  color="primary"
                  hide-details
                />
              </div>

              <v-divider class="my-6" />

              <!-- Display Settings -->
              <div class="mb-6">
                <h3 class="text-h6 font-weight-bold mb-4">
                  <v-icon class="mr-2">mdi-monitor</v-icon>
                  Display
                </h3>
                <v-select
                  v-model="preferences.timezone"
                  :items="timezones"
                  item-title="label"
                  item-value="value"
                  label="Timezone"
                  variant="outlined"
                  prepend-inner-icon="mdi-clock-outline"
                  class="mb-4"
                />
                <v-select
                  v-model="preferences.dateFormat"
                  :items="dateFormats"
                  item-title="label"
                  item-value="value"
                  label="Date Format"
                  variant="outlined"
                  prepend-inner-icon="mdi-calendar"
                />
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

            <v-divider />

            <v-card-actions class="pa-6">
              <v-btn
                variant="outlined"
                :disabled="loading"
                @click="resetToDefaults"
              >
                <v-icon start>mdi-restore</v-icon>
                Reset to Defaults
              </v-btn>
              <v-spacer />
              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                :loading="loading"
              >
                <v-icon start>mdi-content-save</v-icon>
                Save Preferences
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
const { user } = useSupabaseAuth()
const supabase = useSupabaseClient()

// Reactive data
const loading = ref(false)
const success = ref(null)
const error = ref(null)

// Preferences model
const preferences = reactive({
  theme: 'system',
  language: 'en',
  emailNotifications: true,
  pushNotifications: true,
  projectUpdates: true,
  marketingEmails: false,
  profilePublic: true,
  showActivity: true,
  allowContact: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY'
})

// Options data
const languages = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Greek', code: 'el' },
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Russian', code: 'ru' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' }
]

const timezones = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Eastern Time (ET)', value: 'America/New_York' },
  { label: 'Central Time (CT)', value: 'America/Chicago' },
  { label: 'Mountain Time (MT)', value: 'America/Denver' },
  { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { label: 'Central European Time (CET)', value: 'Europe/Paris' },
  { label: 'Eastern European Time (EET)', value: 'Europe/Athens' },
  { label: 'Japan Standard Time (JST)', value: 'Asia/Tokyo' },
  { label: 'China Standard Time (CST)', value: 'Asia/Shanghai' },
  { label: 'India Standard Time (IST)', value: 'Asia/Kolkata' },
  { label: 'Australian Eastern Time (AET)', value: 'Australia/Sydney' }
]

const dateFormats = [
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'DD MMM YYYY', value: 'DD MMM YYYY' },
  { label: 'MMM DD, YYYY', value: 'MMM DD, YYYY' }
]

// Methods
const loadPreferences = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.value.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    if (data) {
      Object.assign(preferences, data)
    }
  } catch (err) {
    console.error('Error loading preferences:', err)
    // Don't show error to user, just use defaults
  }
}

const savePreferences = async () => {
  loading.value = true
  error.value = null
  success.value = null

  try {
    const { error: saveError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.value.id,
        ...preferences,
        updated_at: new Date().toISOString()
      })

    if (saveError) throw saveError

    success.value = 'Preferences saved successfully!'

    // Apply theme change immediately if needed
    if (preferences.theme !== 'system') {
      document.documentElement.setAttribute('data-theme', preferences.theme)
    }
  } catch (err) {
    console.error('Error saving preferences:', err)
    error.value = 'Failed to save preferences. Please try again.'
  } finally {
    loading.value = false
  }
}

const resetToDefaults = () => {
  Object.assign(preferences, {
    theme: 'system',
    language: 'en',
    emailNotifications: true,
    pushNotifications: true,
    projectUpdates: true,
    marketingEmails: false,
    profilePublic: true,
    showActivity: true,
    allowContact: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY'
  })
}

// Lifecycle
onMounted(() => {
  loadPreferences()
})

// Page meta
definePageMeta({
  layout: 'user',
  middleware: 'auth',
  title: 'Preferences'
})

// SEO
useSeoMeta({
  title: 'Preferences - Cloudless.gr',
  description: 'Manage your application preferences and settings'
})
</script>

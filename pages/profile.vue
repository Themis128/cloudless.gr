<template>
  <div>
    <v-container fluid>
      <!-- Header Section -->
      <v-row>
        <v-col cols="12">
          <v-card class="mb-6 primary-gradient" elevation="4">
            <v-card-text class="pa-8">
              <div class="d-flex align-center">
                <v-avatar size="80" color="primary" class="mr-6">
                  <v-img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
                  <span v-else class="text-h4 text-white">
                    {{ user?.name?.charAt(0) || user?.email?.charAt(0) || 'U' }}
                  </span>
                </v-avatar>
                <div class="flex-grow-1">
                  <h1 class="text-h3 font-weight-bold mb-2">{{ user?.name || 'User Profile' }}</h1>
                  <p class="text-h6 text-medium-emphasis mb-2">{{ user?.email }}</p>
                  <v-chip :color="getRoleColor(user?.role)" size="small" variant="tonal">
                    {{ user?.role || 'User' }}
                  </v-chip>
                </div>
                <v-btn
                  color="white"
                  variant="elevated"
                  size="large"
                  prepend-icon="mdi-pencil"
                  @click="editMode = !editMode"
                >
                  {{ editMode ? 'Cancel' : 'Edit Profile' }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <!-- Profile Information -->
        <v-col cols="12" md="8">
          <v-card elevation="2" class="mb-6">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-account</v-icon>
              Personal Information
            </v-card-title>
            <v-card-text>
              <v-form v-if="editMode" @submit.prevent="saveProfile">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="profileForm.firstName"
                      label="First Name"
                      variant="outlined"
                      prepend-inner-icon="mdi-account"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="profileForm.lastName"
                      label="Last Name"
                      variant="outlined"
                      prepend-inner-icon="mdi-account"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="profileForm.email"
                      label="Email Address"
                      type="email"
                      variant="outlined"
                      prepend-inner-icon="mdi-email"
                      readonly
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="profileForm.phone"
                      label="Phone Number"
                      variant="outlined"
                      prepend-inner-icon="mdi-phone"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-textarea
                      v-model="profileForm.bio"
                      label="Bio"
                      variant="outlined"
                      prepend-inner-icon="mdi-text"
                      rows="3"
                    />
                  </v-col>
                </v-row>
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="saving"
                  prepend-icon="mdi-content-save"
                  class="mr-2"
                >
                  Save Changes
                </v-btn>
                <v-btn
                  variant="outlined"
                  @click="editMode = false"
                >
                  Cancel
                </v-btn>
              </v-form>
              
              <div v-else>
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="mb-4">
                      <p class="text-body-2 text-medium-emphasis mb-1">First Name</p>
                      <p class="text-body-1">{{ user?.firstName || 'Not provided' }}</p>
                    </div>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="mb-4">
                      <p class="text-body-2 text-medium-emphasis mb-1">Last Name</p>
                      <p class="text-body-1">{{ user?.lastName || 'Not provided' }}</p>
                    </div>
                  </v-col>
                  <v-col cols="12">
                    <div class="mb-4">
                      <p class="text-body-2 text-medium-emphasis mb-1">Email Address</p>
                      <p class="text-body-1">{{ user?.email }}</p>
                    </div>
                  </v-col>
                  <v-col cols="12">
                    <div class="mb-4">
                      <p class="text-body-2 text-medium-emphasis mb-1">Phone Number</p>
                      <p class="text-body-1">{{ user?.phone || 'Not provided' }}</p>
                    </div>
                  </v-col>
                  <v-col cols="12">
                    <div class="mb-4">
                      <p class="text-body-2 text-medium-emphasis mb-1">Bio</p>
                      <p class="text-body-1">{{ user?.bio || 'No bio provided' }}</p>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-card-text>
          </v-card>

          <!-- Activity History -->
          <v-card elevation="2">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-history</v-icon>
              Recent Activity
            </v-card-title>
            <v-card-text>
              <v-timeline density="compact">
                <v-timeline-item
                  v-for="activity in activities"
                  :key="activity.id"
                  :dot-color="activity.color"
                  size="small"
                >
                  <template #icon>
                    <v-icon size="16">{{ activity.icon }}</v-icon>
                  </template>
                  <div class="d-flex justify-space-between align-center">
                    <div>
                      <p class="text-body-1 mb-1">{{ activity.title }}</p>
                      <p class="text-body-2 text-medium-emphasis">{{ activity.description }}</p>
                    </div>
                    <span class="text-caption">{{ formatDate(activity.timestamp) }}</span>
                  </div>
                </v-timeline-item>
              </v-timeline>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Side Panel -->
        <v-col cols="12" md="4">
          <!-- Account Stats -->
          <v-card elevation="2" class="mb-6">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-chart-box</v-icon>
              Account Statistics
            </v-card-title>
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <p class="text-h4 font-weight-bold">{{ stats.projectsCreated }}</p>
                  <p class="text-body-2 text-medium-emphasis">Projects Created</p>
                </div>
                <v-icon size="32" color="primary">mdi-folder</v-icon>
              </div>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <p class="text-h4 font-weight-bold">{{ stats.workflowsRun }}</p>
                  <p class="text-body-2 text-medium-emphasis">Workflows Run</p>
                </div>
                <v-icon size="32" color="success">mdi-play-circle</v-icon>
              </div>
              <div class="d-flex align-center justify-space-between">
                <div>
                  <p class="text-h4 font-weight-bold">{{ stats.daysActive }}</p>
                  <p class="text-body-2 text-medium-emphasis">Days Active</p>
                </div>
                <v-icon size="32" color="warning">mdi-calendar</v-icon>
              </div>
            </v-card-text>
          </v-card>

          <!-- Security Settings -->
          <v-card elevation="2" class="mb-6">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-shield-check</v-icon>
              Security
            </v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item @click="changePassword">
                  <template #prepend>
                    <v-icon>mdi-lock</v-icon>
                  </template>
                  <v-list-item-title>Change Password</v-list-item-title>
                  <v-list-item-subtitle>Update your account password</v-list-item-subtitle>
                </v-list-item>
                <v-list-item @click="manageTwoFactor">
                  <template #prepend>
                    <v-icon>mdi-two-factor-authentication</v-icon>
                  </template>
                  <v-list-item-title>Two-Factor Authentication</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ user?.twoFactorEnabled ? 'Enabled' : 'Not enabled' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-chip
                      :color="user?.twoFactorEnabled ? 'success' : 'warning'"
                      size="small"
                      variant="tonal"
                    >
                      {{ user?.twoFactorEnabled ? 'On' : 'Off' }}
                    </v-chip>
                  </template>
                </v-list-item>
                <v-list-item @click="viewSessions">
                  <template #prepend>
                    <v-icon>mdi-devices</v-icon>
                  </template>
                  <v-list-item-title>Active Sessions</v-list-item-title>
                  <v-list-item-subtitle>Manage your active sessions</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Quick Actions -->
          <v-card elevation="2">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
              Quick Actions
            </v-card-title>
            <v-card-text>
              <div class="d-grid gap-3">
                <v-btn variant="outlined" block @click="downloadData">
                  <v-icon left>mdi-download</v-icon>
                  Download My Data
                </v-btn>
                <v-btn variant="outlined" block @click="exportSettings">
                  <v-icon left>mdi-cog-transfer</v-icon>
                  Export Settings
                </v-btn>
                <v-btn variant="outlined" color="error" block @click="deleteAccount">
                  <v-icon left>mdi-account-remove</v-icon>
                  Delete Account
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Success Alert -->
    <v-snackbar v-model="showSuccess" color="success" timeout="3000">
      {{ successMessage }}
      <template #actions>
        <v-btn icon="mdi-close" @click="showSuccess = false" />
      </template>
    </v-snackbar>

    <!-- Error Alert -->
    <v-snackbar v-model="showError" color="error" timeout="5000">
      {{ errorMessage }}
      <template #actions>
        <v-btn icon="mdi-close" @click="showError = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Profile',
  middleware: 'auth'
})

const { user } = useAuth()
const editMode = ref(false)
const saving = ref(false)
const showSuccess = ref(false)
const showError = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const profileForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  bio: ''
})

const stats = ref({
  projectsCreated: 12,
  workflowsRun: 247,
  daysActive: 45
})

const activities = ref([
  {
    id: 1,
    title: 'Created new project',
    description: 'E-commerce Platform project was created',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    icon: 'mdi-folder-plus',
    color: 'primary'
  },
  {
    id: 2,
    title: 'Workflow executed',
    description: 'Data Processing workflow completed successfully',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    icon: 'mdi-play-circle',
    color: 'success'
  },
  {
    id: 3,
    title: 'Profile updated',
    description: 'Personal information was modified',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    icon: 'mdi-account-edit',
    color: 'info'
  }
])

// Initialize form with user data
watch(user, (newUser) => {
  if (newUser) {
    profileForm.value = {
      firstName: newUser.firstName || '',
      lastName: newUser.lastName || '',
      email: newUser.email || '',
      phone: newUser.phone || '',
      bio: newUser.bio || ''
    }
  }
}, { immediate: true })

const getRoleColor = (role?: string) => {
  switch (role) {
    case 'admin': return 'error'
    case 'manager': return 'warning'
    case 'developer': return 'primary'
    default: return 'success'
  }
}

const formatDate = (date: Date) => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    .format(Math.ceil((date.getTime() - Date.now()) / (1000 * 60)), 'minute')
}

const saveProfile = async () => {
  saving.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    successMessage.value = 'Profile updated successfully!'
    showSuccess.value = true
    editMode.value = false
  } catch (error) {
    errorMessage.value = 'Failed to update profile. Please try again.'
    showError.value = true
  } finally {
    saving.value = false
  }
}

const changePassword = () => {
  navigateTo('/settings/password')
}

const manageTwoFactor = () => {
  navigateTo('/settings/security')
}

const viewSessions = () => {
  navigateTo('/settings/sessions')
}

const downloadData = async () => {
  // Simulate data download
  successMessage.value = 'Data export initiated. You will receive an email when ready.'
  showSuccess.value = true
}

const exportSettings = async () => {
  // Simulate settings export
  successMessage.value = 'Settings exported successfully!'
  showSuccess.value = true
}

const deleteAccount = () => {
  navigateTo('/settings/delete-account')
}
</script>

<style scoped>
.d-grid {
  display: grid;
}

.gap-3 {
  gap: 12px;
}
</style>

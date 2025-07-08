<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-cog</v-icon>
            Account Settings
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0">
            <!-- Settings Navigation -->
            <v-list>
              <v-list-item
                prepend-icon="mdi-shield-account"
                title="Security"
                subtitle="Password, two-factor authentication"
                @click="$router.push('/users/account/security')"
              >
                <template #append>
                  <v-icon>mdi-chevron-right</v-icon>
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-palette"
                title="Preferences"
                subtitle="Theme, language, notifications"
                @click="$router.push('/users/account/preferences')"
              >
                <template #append>
                  <v-icon>mdi-chevron-right</v-icon>
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-credit-card"
                title="Billing"
                subtitle="Subscription, payment methods"
                @click="$router.push('/users/account/billing')"
              >
                <template #append>
                  <v-icon>mdi-chevron-right</v-icon>
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-bell"
                title="Notifications"
                subtitle="Email, push, and in-app notifications"
                @click="$router.push('/users/notifications')"
              >
                <template #append>
                  <v-icon>mdi-chevron-right</v-icon>
                </template>
              </v-list-item>

              <v-divider />

              <v-list-item
                prepend-icon="mdi-history"
                title="Activity Log"
                subtitle="View your account activity"
                @click="$router.push('/users/activity')"
              >
                <template #append>
                  <v-icon>mdi-chevron-right</v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Quick Actions -->
        <v-row class="mt-6">
          <v-col cols="12" sm="6">
            <v-card variant="outlined" class="pa-4 text-center">
              <v-icon size="48" color="primary" class="mb-3">mdi-download</v-icon>
              <h3 class="text-h6 mb-2">Export Data</h3>
              <p class="text-body-2 text-grey-darken-1 mb-4">
                Download a copy of your account data
              </p>
              <v-btn variant="outlined" color="primary" @click="exportData">
                Export Data
              </v-btn>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6">
            <v-card variant="outlined" class="pa-4 text-center border-error">
              <v-icon size="48" color="error" class="mb-3">mdi-delete-forever</v-icon>
              <h3 class="text-h6 mb-2">Delete Account</h3>
              <p class="text-body-2 text-grey-darken-1 mb-4">
                Permanently delete your account and all data
              </p>
              <v-btn variant="outlined" color="error" @click="showDeleteDialog = true">
                Delete Account
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Delete Account Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5 text-error">
          <v-icon class="mr-2">mdi-alert-circle</v-icon>
          Delete Account
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            Are you sure you want to delete your account? This action cannot be undone.
          </p>
          <p class="text-body-2 text-grey-darken-1">
            All your data, including projects, settings, and profile information will be permanently deleted.
          </p>
          <v-text-field
            v-model="deleteConfirmation"
            label="Type 'DELETE' to confirm"
            variant="outlined"
            class="mt-4"
            :error="deleteConfirmation && deleteConfirmation !== 'DELETE'"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :disabled="deleteConfirmation !== 'DELETE'"
            :loading="deleting"
            @click="deleteAccount"
          >
            Delete Account
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export Success Snackbar -->
    <v-snackbar v-model="showExportSuccess" color="success">
      Data export initiated. You'll receive an email with the download link.
      <template #actions>
        <v-btn variant="text" @click="showExportSuccess = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
const { user, signOut } = useSupabaseAuth()
const supabase = useSupabaseClient()

// Reactive data
const showDeleteDialog = ref(false)
const deleteConfirmation = ref('')
const deleting = ref(false)
const showExportSuccess = ref(false)

// Methods
const exportData = async () => {
  // In a real app, this would trigger a data export process
  // For now, we'll just show a success message
  showExportSuccess.value = true

  // Implement actual data export functionality
  // This would typically trigger a server-side job to export user data
  console.log('Exporting user data...')
}

const deleteAccount = async () => {
  if (deleteConfirmation.value !== 'DELETE') return

  deleting.value = true

  try {
    // Delete user profile data
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.value.id)

    if (profileError) throw profileError

    // Delete user projects (if any)
    const { error: projectsError } = await supabase
      .from('projects')
      .delete()
      .eq('user_id', user.value.id)

    if (projectsError) throw projectsError

    // Delete auth user (this should be done server-side in production)
    // For now, just sign out
    await signOut()

    // Redirect to home
    await navigateTo('/')
  } catch (error) {
    console.error('Error deleting account:', error)
    // Handle error (show notification, etc.)
  } finally {
    deleting.value = false
    showDeleteDialog.value = false
    deleteConfirmation.value = ''
  }
}

// Page meta
definePageMeta({
  layout: 'user',
  title: 'Account Settings'
})

// SEO
useSeoMeta({
  title: 'Account Settings - Cloudless.gr',
  description: 'Manage your account settings and preferences'
})
</script>

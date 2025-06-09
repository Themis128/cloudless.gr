<template>
  <v-container class="pa-4">
    <v-row justify="center">
      <v-col cols="12" lg="8">
        <v-card class="elevation-8">
          <v-card-title class="text-h4 font-weight-bold pa-6">
            <v-icon start icon="mdi-cog" size="32" class="mr-3"></v-icon>
            Account Settings
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text class="pa-6">
            <v-alert v-if="successMessage" type="success" variant="tonal" closable class="mb-4">
              {{ successMessage }}
            </v-alert>

            <v-alert v-if="errorMessage" type="error" variant="tonal" closable class="mb-4">
              {{ errorMessage }}
            </v-alert>

            <!-- Profile Information Section -->
            <v-expansion-panels v-model="openPanels" multiple>
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start icon="mdi-account-edit" class="mr-3"></v-icon>
                  <div>
                    <div class="text-h6">Profile Information</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Update your account information
                    </div>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-form @submit.prevent="updateProfile">
                    <v-row>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="profileData.name"
                          label="Full Name"
                          prepend-inner-icon="mdi-account"
                          variant="outlined"
                          placeholder="Your name"
                          :rules="nameRules"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="profileData.email"
                          label="Email Address"
                          prepend-inner-icon="mdi-email"
                          variant="outlined"
                          placeholder="Your email"
                          disabled
                          hint="Email cannot be changed"
                          persistent-hint
                        ></v-text-field>
                      </v-col>
                    </v-row>

                    <v-btn
                      type="submit"
                      color="primary"
                      :loading="isUpdating"
                      :disabled="isUpdating"
                      prepend-icon="mdi-content-save"
                      class="mt-4"
                    >
                      {{ isUpdating ? 'Updating...' : 'Update Profile' }}
                    </v-btn>
                  </v-form>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Change Password Section -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start icon="mdi-lock-reset" class="mr-3"></v-icon>
                  <div>
                    <div class="text-h6">Change Password</div>
                    <div class="text-body-2 text-medium-emphasis">Update your account password</div>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-form @submit.prevent="updatePassword">
                    <v-row>
                      <v-col cols="12">
                        <v-text-field
                          v-model="passwordData.currentPassword"
                          label="Current Password"
                          prepend-inner-icon="mdi-lock"
                          variant="outlined"
                          placeholder="Enter current password"
                          :rules="currentPasswordRules"
                          :append-inner-icon="showCurrentPassword ? 'mdi-eye-off' : 'mdi-eye'"
                          @click:append-inner="showCurrentPassword = !showCurrentPassword"
                          :type="showCurrentPassword ? 'text' : 'password'"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="passwordData.newPassword"
                          label="New Password"
                          prepend-inner-icon="mdi-lock-plus"
                          variant="outlined"
                          placeholder="Enter new password"
                          :rules="newPasswordRules"
                          :append-inner-icon="showNewPassword ? 'mdi-eye-off' : 'mdi-eye'"
                          @click:append-inner="showNewPassword = !showNewPassword"
                          :type="showNewPassword ? 'text' : 'password'"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="passwordData.confirmPassword"
                          label="Confirm New Password"
                          prepend-inner-icon="mdi-lock-check"
                          variant="outlined"
                          placeholder="Confirm new password"
                          :rules="confirmPasswordRules"
                          :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
                          @click:append-inner="showConfirmPassword = !showConfirmPassword"
                          :type="showConfirmPassword ? 'text' : 'password'"
                        ></v-text-field>
                      </v-col>
                    </v-row>

                    <v-btn
                      type="submit"
                      color="warning"
                      :loading="isUpdatingPassword"
                      :disabled="isUpdatingPassword"
                      prepend-icon="mdi-lock-reset"
                      class="mt-4"
                    >
                      {{ isUpdatingPassword ? 'Updating...' : 'Update Password' }}
                    </v-btn>
                  </v-form>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Preferences Section -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start icon="mdi-tune" class="mr-3"></v-icon>
                  <div>
                    <div class="text-h6">Preferences</div>
                    <div class="text-body-2 text-medium-emphasis">Customize your experience</div>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" sm="6">
                      <v-switch
                        v-model="preferences.emailNotifications"
                        label="Email Notifications"
                        color="primary"
                        hide-details
                      ></v-switch>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-switch
                        v-model="preferences.darkMode"
                        label="Dark Mode"
                        color="primary"
                        hide-details
                      ></v-switch>
                    </v-col>
                  </v-row>

                  <v-btn
                    @click="updatePreferences"
                    color="secondary"
                    :loading="isUpdatingPreferences"
                    :disabled="isUpdatingPreferences"
                    prepend-icon="mdi-content-save"
                    class="mt-4"
                  >
                    {{ isUpdatingPreferences ? 'Saving...' : 'Save Preferences' }}
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>

        <!-- Danger Zone Section -->
        <v-card class="elevation-8 mt-6" color="error-lighten-5">
          <v-card-title class="text-h5 font-weight-bold pa-6 text-error">
            <v-icon start icon="mdi-alert-circle" size="28" class="mr-3"></v-icon>
            Danger Zone
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text class="pa-6">
            <v-alert type="warning" variant="tonal" class="mb-4">
              <v-alert-title>Account Deletion</v-alert-title>
              This action cannot be undone. All your data will be permanently deleted.
            </v-alert>

            <v-btn
              @click="confirmDeleteAccount"
              color="error"
              variant="outlined"
              prepend-icon="mdi-delete-forever"
              size="large"
            >
              Delete Account
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delete Account Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5 font-weight-bold text-error">
          <v-icon start icon="mdi-alert-circle" class="mr-2"></v-icon>
          Confirm Account Deletion
        </v-card-title>

        <v-card-text class="pt-4">
          <v-alert type="error" variant="tonal" class="mb-4">
            <v-alert-title>This action is irreversible!</v-alert-title>
            All your data, projects, and settings will be permanently deleted.
          </v-alert>

          <p class="text-body-1 mb-4">
            Are you absolutely sure you want to delete your account? This cannot be undone.
          </p>

          <v-text-field
            v-model="deleteConfirmation"
            label="Type 'DELETE' to confirm"
            variant="outlined"
            :rules="deleteConfirmationRules"
            placeholder="DELETE"
          ></v-text-field>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false" variant="text"> Cancel </v-btn>
          <v-btn
            @click="deleteAccount"
            color="error"
            :disabled="deleteConfirmation !== 'DELETE' || isDeletingAccount"
            :loading="isDeletingAccount"
          >
            {{ isDeletingAccount ? 'Deleting...' : 'Delete Account' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useUserAuth } from '~/composables/useUserAuth';

  const { currentUser, isLoggedIn } = useUserAuth();

  // Redirect if not logged in
  if (process.client && !isLoggedIn.value) {
    window.location.href = '/auth/login';
  }

  interface ProfileData {
    name: string;
    email: string;
  }

  interface PasswordData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }

  interface Preferences {
    emailNotifications: boolean;
    darkMode: boolean;
  }

  // Form data
  const profileData = ref<ProfileData>({
    name: currentUser.value?.name || '',
    email: currentUser.value?.email || '',
  });

  const passwordData = ref<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const preferences = ref<Preferences>({
    emailNotifications: true,
    darkMode: false,
  });

  // UI state
  const isUpdating = ref<boolean>(false);
  const isUpdatingPassword = ref<boolean>(false);
  const isUpdatingPreferences = ref<boolean>(false);
  const successMessage = ref<string>('');
  const errorMessage = ref<string>('');
  const openPanels = ref<number[]>([0]); // First panel open by default

  // Show/hide password fields
  const showCurrentPassword = ref<boolean>(false);
  const showNewPassword = ref<boolean>(false);
  const showConfirmPassword = ref<boolean>(false);

  // Delete account state
  const showDeleteDialog = ref<boolean>(false);
  const deleteConfirmation = ref<string>('');
  const isDeletingAccount = ref<boolean>(false);

  // Form validation rules
  const nameRules = [
    (v: string) => !!v || 'Name is required',
    (v: string) => v.length >= 2 || 'Name must be at least 2 characters',
  ];

  const currentPasswordRules = [(v: string) => !!v || 'Current password is required'];

  const newPasswordRules = [
    (v: string) => !!v || 'New password is required',
    (v: string) => v.length >= 6 || 'Password must be at least 6 characters',
  ];

  const confirmPasswordRules = [
    (v: string) => !!v || 'Please confirm your password',
    (v: string) => v === passwordData.value.newPassword || 'Passwords do not match',
  ];

  const deleteConfirmationRules = [
    (v: string) => v === 'DELETE' || 'You must type DELETE to confirm',
  ];

  // Helper function to show messages
  const showMessage = (message: string, isError: boolean = false) => {
    if (isError) {
      errorMessage.value = message;
      successMessage.value = '';
    } else {
      successMessage.value = message;
      errorMessage.value = '';
    }
    setTimeout(() => {
      successMessage.value = '';
      errorMessage.value = '';
    }, 5000);
  };

  // Update profile function
  const updateProfile = async (): Promise<void> => {
    isUpdating.value = true;

    try {
      // In a real app, you would call an API to update the profile
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      // Update the current user data (in a real app, this would come from the API response)
      if (currentUser.value) {
        currentUser.value.name = profileData.value.name;
      }

      showMessage('Profile updated successfully!');
    } catch (error) {
      showMessage('Failed to update profile. Please try again.', true);
      console.error('Profile update error:', error);
    } finally {
      isUpdating.value = false;
    }
  };

  // Update password function
  const updatePassword = async (): Promise<void> => {
    if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
      showMessage('Passwords do not match.', true);
      return;
    }

    isUpdatingPassword.value = true;

    try {
      // In a real app, you would call an API to update the password
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      // Clear form
      passwordData.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      };

      showMessage('Password updated successfully!');
    } catch (error) {
      showMessage('Failed to update password. Please try again.', true);
      console.error('Password update error:', error);
    } finally {
      isUpdatingPassword.value = false;
    }
  };

  // Update preferences function
  const updatePreferences = async (): Promise<void> => {
    isUpdatingPreferences.value = true;

    try {
      // In a real app, you would call an API to update preferences
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      showMessage('Preferences saved successfully!');
    } catch (error) {
      showMessage('Failed to save preferences. Please try again.', true);
      console.error('Preferences update error:', error);
    } finally {
      isUpdatingPreferences.value = false;
    }
  };

  // Confirm delete account function
  const confirmDeleteAccount = (): void => {
    showDeleteDialog.value = true;
    deleteConfirmation.value = '';
  };

  // Delete account function
  const deleteAccount = async (): Promise<void> => {
    if (deleteConfirmation.value !== 'DELETE') {
      showMessage('Please type DELETE to confirm account deletion.', true);
      return;
    }

    isDeletingAccount.value = true;

    try {
      // In a real app, you would call an API to delete the account
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      showMessage('Account deleted successfully. Redirecting...');

      // Redirect to home page after a brief delay
      setTimeout(() => {
        if (process.client) {
          window.location.href = '/';
        }
      }, 2000);
    } catch (error) {
      showMessage('Failed to delete account. Please try again.', true);
      console.error('Account deletion error:', error);
    } finally {
      isDeletingAccount.value = false;
      showDeleteDialog.value = false;
    }
  };
</script>

<style scoped>
  /* Custom styles for any remaining non-Vuetify elements */
  .v-expansion-panel-title {
    padding: 16px 24px;
  }

  .v-expansion-panel-text {
    padding: 0 24px 24px;
  }

  /* Override Vuetify error card background for better visibility */
  .v-card.error-lighten-5 {
    background-color: rgba(255, 235, 238, 0.5) !important;
  }
</style>

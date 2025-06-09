<template>
  <v-container class="pa-4">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-8">
          <v-card-title class="text-h4 font-weight-bold d-flex align-center pa-6">
            <v-avatar v-if="currentUser" color="primary" size="64" class="mr-4">
              <span class="text-h4 font-weight-bold">{{ userInitials }}</span>
            </v-avatar>
            <div>
              <h1 class="text-h4">My Profile</h1>
              <p class="text-subtitle-1 text-medium-emphasis">Manage your account information</p>
            </div>
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text v-if="currentUser" class="pa-6">
            <v-row>
              <v-col cols="12">
                <v-card variant="outlined" class="mb-4">
                  <v-card-title class="text-h6 bg-grey-lighten-5">
                    <v-icon start icon="mdi-account-circle"></v-icon>
                    Account Information
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <v-row>
                      <v-col cols="12" sm="6">
                        <v-list-item class="px-0">
                          <v-list-item-title class="text-subtitle-2 text-medium-emphasis"
                            >Name</v-list-item-title
                          >
                          <v-list-item-subtitle class="text-body-1 font-weight-medium">
                            {{ currentUser.name }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-list-item class="px-0">
                          <v-list-item-title class="text-subtitle-2 text-medium-emphasis"
                            >Email</v-list-item-title
                          >
                          <v-list-item-subtitle class="text-body-1 font-weight-medium">
                            {{ currentUser.email }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-list-item class="px-0">
                          <v-list-item-title class="text-subtitle-2 text-medium-emphasis"
                            >Member Since</v-list-item-title
                          >
                          <v-list-item-subtitle class="text-body-1 font-weight-medium">
                            {{ formattedDate }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-list-item class="px-0">
                          <v-list-item-title class="text-subtitle-2 text-medium-emphasis"
                            >Role</v-list-item-title
                          >
                          <v-list-item-subtitle>
                            <v-chip
                              :color="currentUser.role === 'admin' ? 'primary' : 'secondary'"
                              size="small"
                              variant="elevated"
                            >
                              {{ currentUser.role || 'User' }}
                            </v-chip>
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>

                <v-card variant="outlined">
                  <v-card-title class="text-h6 bg-grey-lighten-5">
                    <v-icon start icon="mdi-cog"></v-icon>
                    Account Settings
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <v-row>
                      <v-col cols="12" sm="6">
                        <v-btn
                          to="/settings"
                          color="primary"
                          variant="outlined"
                          size="large"
                          prepend-icon="mdi-cog"
                          block
                        >
                          Manage Settings
                        </v-btn>
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-btn
                          @click="handleLogout"
                          color="error"
                          variant="outlined"
                          size="large"
                          prepend-icon="mdi-logout"
                          block
                        >
                          Log Out
                        </v-btn>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-text v-else class="pa-6 text-center">
            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            <p class="text-h6 mt-4">Loading your profile...</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useUserAuth } from '~/composables/useUserAuth';

  const { currentUser, logout, isLoggedIn } = useUserAuth();

  // Redirect if not logged in
  if (process.client && !isLoggedIn.value) {
    await navigateTo('/auth/login');
  }

  // Computed properties
  const userInitials = computed<string>(() => {
    if (!currentUser.value?.name) return '?';
    return currentUser.value.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  });

  const formattedDate = computed<string>(() => {
    if (!currentUser.value?.createdAt) return 'N/A';
    return new Date(currentUser.value.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  // Logout handler
  const handleLogout = async (): Promise<void> => {
    await logout();
    await navigateTo('/');
  };

  // Set page meta
  definePageMeta({
    layout: 'default',
    middleware: ['user-auth'],
  });
</script>

<style scoped>
  .profile-container {
    min-height: 90vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
  }

  .profile-card {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    padding: 2rem;
    width: 100%;
    max-width: 600px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(203, 213, 225, 0.5);
  }

  .profile-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1e40af;
    margin: 0;
  }

  .user-avatar {
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #1e40af, #3b82f6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1.125rem;
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .profile-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e40af;
    margin-bottom: 1rem;
  }

  .profile-field {
    margin-bottom: 1rem;
  }

  .profile-field label {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
    display: block;
    margin-bottom: 0.25rem;
  }

  .profile-field p {
    color: #1f2937;
    font-size: 1rem;
    margin: 0;
  }

  .role-badge {
    display: inline-block;
    background-color: #1e40af;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .settings-button {
    background-color: #1e40af;
    color: white;
    text-decoration: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: background-color 0.2s;
    text-align: center;
  }

  .settings-button:hover {
    background-color: #1e3a8a;
  }

  .logout-button {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .logout-button:hover {
    background-color: #dc2626;
  }

  .profile-loading {
    text-align: center;
    padding: 2rem 0;
    color: #64748b;
  }

  @media (max-width: 640px) {
    .profile-card {
      padding: 1.5rem;
    }

    .profile-header {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
    }

    .profile-actions {
      flex-direction: column;
    }
  }
</style>

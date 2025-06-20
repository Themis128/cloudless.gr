<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-account-circle</v-icon>
            My Profile
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-6">
            <!-- Profile Avatar -->
            <div class="text-center mb-6">
              <v-avatar size="120" class="mb-4">
                <v-img
                  :src="userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${userDisplayName}&size=120&background=1976d2&color=fff`"
                  :alt="`${userDisplayName} avatar`"
                />
              </v-avatar>
              <v-btn
                variant="outlined"
                size="small"
                color="primary"
                @click="$router.push('/users/profile/edit')"
              >
                <v-icon start>mdi-camera</v-icon>
                Change Photo
              </v-btn>
            </div>

            <!-- Profile Information -->
            <v-row>
              <v-col cols="12" sm="6">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">First Name</div>
                  <div class="text-h6">{{ userProfile?.first_name || 'Not set' }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Last Name</div>
                  <div class="text-h6">{{ userProfile?.last_name || 'Not set' }}</div>
                </v-card>
              </v-col>
              <v-col cols="12">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Email</div>
                  <div class="text-h6">{{ user?.email }}</div>
                  <v-chip
                    v-if="user?.email_confirmed_at"
                    color="success"
                    size="small"
                    class="mt-2"
                  >
                    <v-icon start>mdi-check-circle</v-icon>
                    Verified
                  </v-chip>
                  <v-chip
                    v-else
                    color="warning"
                    size="small"
                    class="mt-2"
                  >
                    <v-icon start>mdi-alert-circle</v-icon>
                    Unverified
                  </v-chip>
                </v-card>
              </v-col>
              <v-col v-if="userProfile?.bio" cols="12">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Bio</div>
                  <div class="text-body-1">{{ userProfile.bio }}</div>
                </v-card>
              </v-col>
            </v-row>

            <!-- Account Stats -->
            <v-row class="mt-4">
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="primary" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-calendar-account</v-icon>
                  <div class="text-subtitle2">Member Since</div>
                  <div class="text-h6">{{ formatDate(user?.created_at) }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="success" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-folder-multiple</v-icon>
                  <div class="text-subtitle2">Projects</div>
                  <div class="text-h6">{{ projectsCount || 0 }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="info" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-clock-outline</v-icon>
                  <div class="text-subtitle2">Last Active</div>
                  <div class="text-h6">{{ formatDate(user?.last_sign_in_at) }}</div>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-6">
            <v-btn
              color="primary"
              variant="flat"
              @click="$router.push('/users/profile/edit')"
            >
              <v-icon start>mdi-pencil</v-icon>
              Edit Profile
            </v-btn>
            <v-spacer />
            <v-btn
              variant="outlined"
              @click="$router.push('/users/account')"
            >
              <v-icon start>mdi-cog</v-icon>
              Account Settings
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>

import { useUserProfileStore } from '@/stores/userProfileStore'
const user = useSupabaseAuth().user
const userProfileStore = useUserProfileStore()
const userProfile = computed(() => userProfileStore.userProfile)
const projects = computed(() => fetchProjectsStore.projects)
onMounted(() => {
  userProfileStore.loadProfile()
  fetchProjectsStore.fetchProjects()
})

// Computed
const userDisplayName = computed(() => {
  if (userProfile.value?.first_name || userProfile.value?.last_name) {
    return `${userProfile.value.first_name || ''} ${userProfile.value.last_name || ''}`.trim()
  }
  return userProfile.value?.email || user.value?.email || 'User'
})

const projectsCount = computed(() => {
  return projects.value?.length || 0
})

// Methods
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Page meta
definePageMeta({
  layout: 'user',
  middleware: 'auth',
  title: 'My Profile'
})

// SEO
useSeoMeta({
  title: 'My Profile - Cloudless.gr',
  description: 'View and manage your profile information'
})
</script>

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
                  :src="user.value?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${userDisplayName}&size=120&background=1976d2&color=fff`"
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
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Full Name</div>
                  <div class="text-h6">{{ user.value?.user_metadata?.full_name || 'Not set' }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Role</div>
                  <div class="text-h6">
                    <v-chip
                      :color="getRoleColor(user.value?.user_metadata?.role)"
                      size="small"
                      variant="flat"
                      class="text-capitalize"
                    >
                      <v-icon :icon="getRoleIcon(user.value?.user_metadata?.role)" size="16" class="mr-1" />
                      {{ user.value?.user_metadata?.role || 'user' }}
                    </v-chip>
                  </div>
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
              <v-col v-if="user.value?.user_metadata?.bio" cols="12">
                <v-card variant="outlined" class="pa-4">
                  <div class="text-subtitle2 text-grey-darken-1 mb-1">Bio</div>
                  <div class="text-body-1">{{ user.value?.user_metadata?.bio }}</div>
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
import { useFetchProjects } from '@/composables/useFetchProjects'



import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
const { user } = useSupabaseAuth()
const fetchProjectsStore = useFetchProjects()
const projects = computed(() => fetchProjectsStore.projects)



onMounted(() => {
  fetchProjectsStore.fetchProjects()
})


// Computed
const userDisplayName = computed(() => {
  const meta = user.value?.user_metadata || {}
  if (meta.full_name) return meta.full_name.trim()
  if (meta.first_name && meta.last_name) return `${meta.first_name} ${meta.last_name}`
  if (meta.first_name) return meta.first_name
  if (user.value?.email) return user.value.email.split('@')[0]
  return 'User'
})

const projectsCount = computed(() => {
  return projects.value?.length || 0
})

// Methods
const getRoleColor = (role) => {
  switch (role) {
    case 'admin':
      return 'error'
    case 'moderator':
      return 'warning'
    case 'user':
    default:
      return 'primary'
  }
}

const getRoleIcon = (role) => {
  switch (role) {
    case 'admin':
      return 'mdi-shield-crown'
    case 'moderator':
      return 'mdi-shield-check'
    case 'user':
    default:
      return 'mdi-account'
  }
}

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
  title: 'My Profile'
})

// SEO
useSeoMeta({
  title: 'My Profile - Cloudless.gr',
  description: 'View and manage your profile information'
})
</script>

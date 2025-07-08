<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-4">
          <v-card-title class="text-h5 font-weight-bold text-primary pa-6 pb-4">
            <v-icon class="mr-3">mdi-account-edit</v-icon>
            Edit Profile
          </v-card-title>

          <v-divider />

          <v-form ref="formRef" @submit.prevent="updateProfile">
            <v-card-text class="pa-6">
              <!-- Avatar Upload -->
              <div class="text-center mb-6">
                <v-avatar size="120" class="mb-4">
                  <v-img
                    :src="form.avatar_url || `https://ui-avatars.com/api/?name=${userDisplayName}&size=120&background=1976d2&color=fff`"
                    :alt="`${userDisplayName} avatar`"
                  />
                </v-avatar>
                <div>
                  <v-btn
                    variant="outlined"
                    size="small"
                    :loading="uploading"
                    @click="$refs.avatarInput.click()"
                  >
                    <v-icon start>mdi-camera</v-icon>
                    Change Photo
                  </v-btn>
                  <input
                    ref="avatarInput"
                    type="file"
                    accept="image/*"
                    style="display: none"
                    @change="handleAvatarUpload"
                  >
                </div>
              </div>

              <!-- Profile Form -->
              <v-alert
                type="info"
                variant="outlined"
                class="mb-4"
                density="compact"
              >
                <v-icon icon="mdi-information" />
                Note: We use a single "Full Name" field. Separate first/last name fields are not currently supported.
              </v-alert>
              
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.full_name"
                    label="Full Name"
                    variant="outlined"
                    :rules="[rules.required]"
                    prepend-inner-icon="mdi-account"
                    placeholder="Enter your full name"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.role"
                    label="Role"
                    variant="outlined"
                    :items="roleOptions"
                    item-title="label"
                    item-value="value"
                    prepend-inner-icon="mdi-shield-account"
                    :readonly="!isAdmin"
                    :hint="!isAdmin ? 'Contact an administrator to change your role' : ''"
                    :persistent-hint="!isAdmin"
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon :icon="item.raw.icon" :color="item.raw.color" />
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip
                        :color="item.raw.color"
                        size="small"
                        variant="flat"
                      >
                        <v-icon :icon="item.raw.icon" size="16" class="mr-1" />
                        {{ item.raw.label }}
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.email"
                    label="Email"
                    variant="outlined"
                    type="email"
                    :rules="[rules.required, rules.email]"
                    prepend-inner-icon="mdi-email"
                    readonly
                    hint="Contact support to change your email address"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="form.bio"
                    label="Bio"
                    variant="outlined"
                    rows="3"
                    counter="500"
                    :rules="[rules.maxLength(500)]"
                    prepend-inner-icon="mdi-text"
                    placeholder="Tell us about yourself..."
                  />
                </v-col>
              </v-row>

              <!-- Error Alert -->
              <v-alert
                v-if="error"
                type="error"
                class="mt-4"
                closable
                @click:close="error = null"
              >
                {{ error }}
              </v-alert>

              <!-- Success Alert -->
              <v-alert
                v-if="success"
                type="success"
                class="mt-4"
                closable
                @click:close="success = null"
              >
                {{ success }}
              </v-alert>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-6">
              <v-btn
                variant="outlined"
                :disabled="loading"
                @click="$router.push('/users/profile')"
              >
                Cancel
              </v-btn>
              <v-spacer />
              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                :loading="loading"
              >
                <v-icon start>mdi-content-save</v-icon>
                Save Changes
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>

import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { useSupabaseClient } from '#imports'
const user = useSupabaseAuth().user
const supabase = useSupabaseClient()

// Reactive data
const formRef = ref(null)
const avatarInput = ref(null)
const loading = ref(false)
const uploading = ref(false)
const error = ref(null)
const success = ref(null)

// Form data
const form = reactive({
  full_name: '',
  email: '',
  bio: '',
  avatar_url: '',
  role: 'user'
})

// Role options
const roleOptions = [
  {
    value: 'user',
    label: 'User',
    icon: 'mdi-account',
    color: 'primary'
  },
  {
    value: 'moderator',
    label: 'Moderator',
    icon: 'mdi-shield-check',
    color: 'warning'
  },
  {
    value: 'admin',
    label: 'Administrator',
    icon: 'mdi-shield-crown',
    color: 'error'
  }
]

// Validation rules
const rules = {
  required: (value) => !!value || 'This field is required',
  email: (value) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value) || 'Please enter a valid email address'
  },
  maxLength: (max) => (value) => !value || value.length <= max || `Maximum ${max} characters allowed`
}

// Computed
const isAdmin = computed(() => {
  const meta = user.value?.user_metadata || {}
  return meta.role === 'admin'
})

const userDisplayName = computed(() => {
  const meta = user.value?.user_metadata || {}
  if (form.full_name) return form.full_name.trim()
  if (meta.full_name) return meta.full_name
  if (meta.first_name && meta.last_name) return `${meta.first_name} ${meta.last_name}`
  if (meta.first_name) return meta.first_name
  return form.email || user.value?.email || 'User'
})

// Methods
const initializeForm = () => {
  const meta = user.value?.user_metadata || {}
  form.full_name = meta.full_name || ''
  form.bio = meta.bio || ''
  form.avatar_url = meta.avatar_url || ''
  form.role = meta.role || 'user'
  if (user.value) {
    form.email = user.value.email || ''
  }
}

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    error.value = 'File size must be less than 5MB'
    return
  }

  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file'
    return
  }

  uploading.value = true
  error.value = null

  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.value.id}_${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    form.avatar_url = data.publicUrl
    success.value = 'Avatar uploaded successfully!'
  } catch (err) {
    console.error('Avatar upload error:', err)
    error.value = 'Failed to upload avatar. Please try again.'
  } finally {
    uploading.value = false
  }
}

const updateProfile = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = null
  success.value = null

  try {
    const updateData = {
      id: user.value.id,
      full_name: form.full_name,
      bio: form.bio,
      avatar_url: form.avatar_url,
      updated_at: new Date().toISOString()
    }

    // Only include role if user is admin (can edit roles)
    if (isAdmin.value) {
      updateData.role = form.role
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(updateData)

    if (updateError) throw updateError

    success.value = 'Profile updated successfully!'

    // Redirect after a short delay
    setTimeout(() => {
      navigateTo('/users/profile')
    }, 1500)
  } catch (err) {
    console.error('Profile update error:', err)
    error.value = 'Failed to update profile. Please try again.'
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  initializeForm()
})



// Page meta
definePageMeta({
  layout: 'user',
  title: 'Edit Profile'
})

// SEO
useSeoMeta({
  title: 'Edit Profile - Cloudless.gr',
  description: 'Update your profile information and settings'
})
</script>

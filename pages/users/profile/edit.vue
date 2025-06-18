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
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.first_name"
                    label="First Name"
                    variant="outlined"
                    :rules="[rules.required]"
                    prepend-inner-icon="mdi-account"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.last_name"
                    label="Last Name"
                    variant="outlined"
                    :rules="[rules.required]"
                    prepend-inner-icon="mdi-account"
                  />
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
const { user } = useSupabaseAuth()
const { userProfile, refreshProfile } = useUserProfile()
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
  first_name: '',
  last_name: '',
  email: '',
  bio: '',
  avatar_url: ''
})

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
const userDisplayName = computed(() => {
  const firstName = form.first_name || userProfile.value?.first_name
  const lastName = form.last_name || userProfile.value?.last_name
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim()
  }
  return form.email || user.value?.email || 'User'
})

// Methods
const initializeForm = () => {
  if (userProfile.value) {
    form.first_name = userProfile.value.first_name || ''
    form.last_name = userProfile.value.last_name || ''
    form.bio = userProfile.value.bio || ''
    form.avatar_url = userProfile.value.avatar_url || ''
  }
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
    const { error: updateError } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.value.id,
        first_name: form.first_name,
        last_name: form.last_name,
        bio: form.bio,
        avatar_url: form.avatar_url,
        updated_at: new Date().toISOString()
      })

    if (updateError) throw updateError

    await refreshProfile()
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

watch(() => userProfile.value, () => {
  initializeForm()
}, { immediate: true })

// Page meta
definePageMeta({
  layout: 'user',
  middleware: 'auth',
  title: 'Edit Profile'
})

// SEO
useSeoMeta({
  title: 'Edit Profile - Cloudless.gr',
  description: 'Update your profile information and settings'
})
</script>

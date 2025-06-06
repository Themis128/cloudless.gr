<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-container class="text-center">
      <v-row justify="center">
        <v-col cols="12" sm="8" md="6" lg="4">
          <v-card elevation="3" rounded="lg" class="pa-8">
            <!-- Error Icon -->
            <v-icon
              icon="mdi-lock-alert"
              size="80"
              color="error"
              class="mb-4"
            />

            <!-- Title -->
            <h1 class="text-h4 font-weight-bold mb-4 text-error">
              Access Denied
            </h1>

            <!-- Dynamic Message -->
            <div v-if="reason === 'admin-required'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                This page requires administrator privileges.
              </p>
              <v-icon icon="mdi-shield-crown" color="warning" class="mb-2" />
              <p class="text-caption">
                Contact your system administrator if you believe this is an error.
              </p>
            </div>

            <div v-else-if="reason === 'role-required'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                You don't have the required permissions to access this page.
              </p>
              <v-icon icon="mdi-account-lock" color="warning" class="mb-2" />
              <p class="text-caption">
                Your current role doesn't include access to this resource.
              </p>
            </div>

            <div v-else>
              <p class="text-body-1 text-medium-emphasis mb-4">
                You don't have permission to access this page.
              </p>
              <v-icon icon="mdi-information" color="info" class="mb-2" />
              <p class="text-caption">
                Please ensure you have the proper access rights.
              </p>
            </div>

            <!-- Actions -->
            <v-divider class="my-6" />

            <div class="d-flex flex-column gap-3">
              <v-btn
                color="primary"
                variant="elevated"
                @click="goHome"
                block
                prepend-icon="mdi-home"
              >
                Go to Dashboard
              </v-btn>

              <v-btn
                variant="outlined"
                @click="goBack"
                block
                prepend-icon="mdi-arrow-left"
              >
                Go Back
              </v-btn>

              <!-- Contact Admin for admin-required cases -->
              <v-btn
                v-if="reason === 'admin-required'"
                color="info"
                variant="text"
                href="/contact"
                block
                prepend-icon="mdi-email"
              >
                Contact Support
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  public: true, // Allow access to unauthorized page without auth
  layout: 'default'
})

useSeoMeta({
  title: 'Access Denied - Cloudless.gr',
  description: 'You do not have permission to access this page.',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const router = useRouter()

// Get the reason for denial from query params
const reason = computed(() => route.query.reason as string || 'unknown')

const goHome = () => {
  router.push('/dashboard')
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>

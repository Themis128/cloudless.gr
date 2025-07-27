<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card>
          <v-card-title class="text-h4 text-center pa-6">
            Welcome to Cloudless
          </v-card-title>
          
          <v-card-text class="text-center">
            <p class="text-body-1 mb-6">
              Please sign in to your account or create a new one to get started.
            </p>
            
            <v-row>
              <v-col cols="12" sm="6">
                <v-btn
                  color="primary"
                  block
                  size="large"
                  to="/auth/login"
                  class="mb-2"
                >
                  <v-icon left>mdi-login</v-icon>
                  Sign In
                </v-btn>
              </v-col>
              
              <v-col cols="12" sm="6">
                <v-btn
                  color="secondary"
                  block
                  size="large"
                  to="/auth/register"
                  class="mb-2"
                >
                  <v-icon left>mdi-account-plus</v-icon>
                  Sign Up
                </v-btn>
              </v-col>
            </v-row>
            
            <v-divider class="my-6"></v-divider>
            
            <v-btn
              text
              color="primary"
              to="/"
              class="mt-4"
            >
              <v-icon left>mdi-arrow-left</v-icon>
              Back to Home
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Set page title
useHead({
  title: 'Authentication - Cloudless'
})

// Check if user is already authenticated
const authStore = useAuthStore()
const router = useRouter()

// Redirect to dashboard if already authenticated
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
  }
})
</script>

<style scoped>
.v-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.v-btn {
  border-radius: 8px;
}
</style> 
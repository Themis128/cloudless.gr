<template>
  <div class="warning-page">
    <v-container class="fill-height" fluid>
      <v-row align="center" justify="center">
        <v-col cols="12" sm="10" md="8" lg="6">
          <v-card class="elevation-24 warning-card" rounded="xl">
            <!-- Animated Warning Header -->
            <v-card-title class="text-center pa-8 warning-header">
              <div class="warning-animation">
                <v-icon 
                  icon="mdi-shield-alert" 
                  size="80" 
                  color="warning"
                  class="warning-icon pulse"
                />
                <div class="warning-sparks">
                  <v-icon icon="mdi-star-four-points" size="20" color="yellow" class="spark spark1" />
                  <v-icon icon="mdi-star-four-points" size="16" color="orange" class="spark spark2" />
                  <v-icon icon="mdi-star-four-points" size="18" color="red" class="spark spark3" />
                </div>
              </div>
              <h1 class="text-h3 mt-4 warning-title">🚨 HALT! 🚨</h1>
              <h2 class="text-h5 mt-2 text-red">UNAUTHORIZED ADMIN ACCESS DETECTED</h2>
            </v-card-title>

            <v-card-text class="pa-8 text-center">
              <div class="warning-content">
                <h3 class="text-h4 mb-4 text-warning">⚠️ WHO GOES THERE? ⚠️</h3>
                
                <p class="text-h6 mb-4 text-primary">
                  🕵️‍♂️ Nice try, but you need to be an <strong>ADMIN</strong> to access this secret area!
                </p>
                
                <v-divider class="my-6" />
                
                <div class="funny-messages mb-6">
                  <p class="text-body-1 mb-3">
                    🤖 <em>"I'm sorry {{ userName }}, I'm afraid I can't do that."</em>
                  </p>
                  <p class="text-body-1 mb-3">
                    🔐 This area is more protected than a dragon's treasure!
                  </p>
                  <p class="text-body-1 mb-3">
                    👑 You need the sacred admin crown to proceed!
                  </p>
                </div>

                <v-alert 
                  type="info" 
                  variant="tonal" 
                  class="mb-6"
                  icon="mdi-information"
                >
                  <template #title>
                    🎭 Plot Twist!
                  </template>
                  If you ARE an admin, please login below. If you're not... well, this is awkward. 😅
                </v-alert>

                <div class="action-buttons">
                  <v-btn
                    color="success"
                    size="large"
                    variant="elevated"
                    class="mx-2 mb-3"
                    prepend-icon="mdi-login"
                    @click="goToAdminLogin"
                  >
                    🔑 I AM THE ADMIN! LOGIN
                  </v-btn>
                  
                  <v-btn
                    color="primary"
                    size="large"
                    variant="outlined"
                    class="mx-2 mb-3"
                    prepend-icon="mdi-home"
                    @click="goHome"
                  >
                    🏠 Take Me Home
                  </v-btn>
                  
                  <v-btn
                    color="warning"
                    size="large"
                    variant="text"
                    class="mx-2 mb-3"
                    prepend-icon="mdi-help-circle"
                    @click="showHelp = !showHelp"
                  >
                    🤔 I'm Confused
                  </v-btn>
                </div>

                <v-expand-transition>
                  <v-card v-show="showHelp" variant="tonal" color="info" class="mt-4 pa-4">
                    <h4 class="text-h6 mb-2">🎯 Quick Help:</h4>
                    <ul class="text-left">
                      <li><strong>For Admins:</strong> Click "I AM THE ADMIN! LOGIN" and use your credentials</li>
                      <li><strong>For Users:</strong> Click "Take Me Home" to go back to the main site</li>
                      <li><strong>For Hackers:</strong> 🛡️ Nice try, but our security is tighter than a pickle jar!</li>
                    </ul>
                  </v-card>
                </v-expand-transition>
              </div>
            </v-card-text>

            <v-card-actions class="pa-6 justify-center">
              <v-chip color="red" variant="outlined" class="mr-2">
                <v-icon start icon="mdi-account-off" />
                Access Level: {{ accessLevel }}
              </v-chip>
              <v-chip color="orange" variant="outlined">
                <v-icon start icon="mdi-shield-check" />
                Required: ADMIN
              </v-chip>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Page configuration
definePageMeta({
  layout: 'default',
  title: 'Admin Access Required'
})

// Set head
useHead({
  title: '🚨 Admin Access Required - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Administrative access required to view this content.' }
  ]
})

// Reactive data
const showHelp = ref(false)
const userName = ref('Anonymous User')
const accessLevel = ref('GUEST')

// Methods
const goToAdminLogin = () => {
  const route = useRoute()
  const redirect = route.query.redirect as string
  const loginUrl = redirect ? `/auth/admin-login?redirect=${encodeURIComponent(redirect)}` : '/auth/admin-login'
  navigateTo(loginUrl)
}

const goHome = () => {
  navigateTo('/')
}

// Get user info if available
onMounted(async () => {
  try {
    // Try to get session from the API
    const session = await $fetch('/api/auth/session').catch(() => null)
    
    if (session?.user?.name) {
      userName.value = session.user.name
      accessLevel.value = session.user.role?.toUpperCase() || 'USER'
    }
  } catch (error) {
    console.log('No auth session available')
    // Keep default values
  }
})
</script>

<style scoped>
.warning-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #ff6b6b 0%, #ffd93d 50%, #6bcf7f 100%);
  animation: gradientShift 8s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% { background: linear-gradient(135deg, #ff6b6b 0%, #ffd93d 50%, #6bcf7f 100%); }
  50% { background: linear-gradient(135deg, #6bcf7f 0%, #4ecdc4 50%, #45b7d1 100%); }
}

.warning-card {
  border: 4px solid #ff6b6b;
  box-shadow: 0 20px 40px rgba(255, 107, 107, 0.3);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.warning-header {
  background: linear-gradient(45deg, #ff6b6b, #ffd93d);
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.warning-animation {
  position: relative;
  display: inline-block;
}

.warning-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.warning-sparks {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.spark {
  position: absolute;
  animation: sparkle 3s infinite;
}

.spark1 {
  top: 10%;
  right: 10%;
  animation-delay: 0s;
}

.spark2 {
  bottom: 20%;
  left: 15%;
  animation-delay: 1s;
}

.spark3 {
  top: 30%;
  left: 0%;
  animation-delay: 2s;
}

@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}

.warning-title {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
}

.funny-messages {
  animation: fadeInUp 1s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.action-buttons .v-btn {
  transition: all 0.3s ease;
}

.action-buttons .v-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .warning-card {
    margin: 16px;
  }
  
  .warning-icon {
    font-size: 60px !important;
  }
  
  .warning-title {
    font-size: 2rem !important;
  }
  
  .action-buttons .v-btn {
    width: 100%;
    margin: 8px 0 !important;
  }
}
</style>

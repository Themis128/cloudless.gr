<template>
  <v-app>
    <!-- Background with Vuetify components -->
    <v-container
      fluid
      class="auth-background pa-0"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -2;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      "
    >
      <!-- Floating shapes using Vuetify -->
      <v-row class="floating-shapes" style="height: 100%; position: relative">
        <v-col cols="auto" class="shape-container">
          <v-avatar
            size="80"
            color="rgba(255, 255, 255, 0.1)"
            class="floating-shape"
            style="animation-delay: 0s"
          />
        </v-col>
        <v-col cols="auto" class="shape-container">
          <v-avatar
            size="120"
            color="rgba(255, 255, 255, 0.1)"
            class="floating-shape"
            style="animation-delay: 2s"
          />
        </v-col>
        <v-col cols="auto" class="shape-container">
          <v-avatar
            size="60"
            color="rgba(255, 255, 255, 0.1)"
            class="floating-shape"
            style="animation-delay: 4s"
          />
        </v-col>
        <v-col cols="auto" class="shape-container">
          <v-avatar
            size="100"
            color="rgba(255, 255, 255, 0.1)"
            class="floating-shape"
            style="animation-delay: 1s"
          />
        </v-col>
        <v-col cols="auto" class="shape-container">
          <v-avatar
            size="40"
            color="rgba(255, 255, 255, 0.1)"
            class="floating-shape"
            style="animation-delay: 3s"
          />
        </v-col>
      </v-row>
    </v-container>

    <!-- Main Content -->
    <v-main class="auth-content">
      <v-container
        fluid
        class="d-flex align-center justify-center"
        style="min-height: calc(100vh - 80px)"
      >
        <slot />
      </v-container>
    </v-main>

    <!-- Footer -->
    <v-footer class="auth-footer">
      <v-container>
        <v-row justify="space-between" align="center">
          <v-col cols="auto">
            <v-chip
              color="rgba(255, 255, 255, 0.8)"
              variant="text"
              size="small"
            >
              &copy; 2024 Cloudless Wizard. All rights reserved.
            </v-chip>
          </v-col>

          <v-col cols="auto">
            <v-row align="center" no-gutters>
              <v-btn
                to="/privacy"
                variant="text"
                color="rgba(255, 255, 255, 0.8)"
                size="small"
                class="mr-4"
              >
                Privacy Policy
              </v-btn>
              <v-btn
                to="/terms"
                variant="text"
                color="rgba(255, 255, 255, 0.8)"
                size="small"
                class="mr-4"
              >
                Terms of Service
              </v-btn>
              <v-btn
                to="/support"
                variant="text"
                color="rgba(255, 255, 255, 0.8)"
                size="small"
              >
                Support
              </v-btn>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
// No additional logic needed for auth layout
</script>

<style scoped>
.auth-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
}

.floating-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1;
}

.shape-container {
  position: absolute;
}

.shape-container:nth-child(1) {
  top: 20%;
  left: 10%;
}

.shape-container:nth-child(2) {
  top: 60%;
  right: 10%;
}

.shape-container:nth-child(3) {
  top: 80%;
  left: 20%;
}

.shape-container:nth-child(4) {
  top: 10%;
  right: 30%;
}

.shape-container:nth-child(5) {
  top: 40%;
  left: 60%;
}

.floating-shape {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
    opacity: 1;
  }
}

.auth-content {
  position: relative;
  z-index: 1;
}

.auth-footer {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .v-row {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .floating-shape {
    display: none;
  }
}
</style>

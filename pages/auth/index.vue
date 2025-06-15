<template>
  <v-container class="pa-12" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="glass-card" elevation="8">
          <v-card-title class="text-h5 font-weight-bold text-center white--text">
            Login to Cloudless
          </v-card-title>

          <v-card-text class="d-flex flex-column align-center justify-center" style="min-height: 420px;">
            <LoginForm /> <!-- LoginForm Component -->
            <!-- Register and error handling are now handled by LoginForm -->
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import LoginForm from '~/components/auth/LoginForm.vue'
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); /* More pronounced shadow */
  padding: 2rem;
  transition: box-shadow 0.3s ease;
  position: relative;
}

.glass-card:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4); /* Hover effect for a bigger shadow */
}

.v-btn {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.v-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.v-snackbar {
  z-index: 1000;
}

/* Optional: Style the title text for better visibility on darker backgrounds */
.text-h5 {
  font-weight: bold;
}

/* Optional: Extra margin for smaller devices */
@media (max-width: 600px) {
  .glass-card {
    padding: 1.5rem;
  }
}
</style>

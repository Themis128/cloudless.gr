<template>
  <VApp>
    <!-- Animated Vanta Background -->
    <client-only>
      <Suspense>
        <template #default>
          <VantaBackground />
        </template>
        <template #fallback>
          <div class="fallback-bg" />
        </template>
      </Suspense>
    </client-only>

    <div class="content-container">
      <VMain class="main-content">
        <v-container class="text-center">
          <v-row>
            <v-col>
              <h1 class="text-h4 font-weight-bold mb-4 vanta-sky">Welcome to Cloudless GR</h1>
              <p class="vanta-white">This is the landing page of your Nuxt 3 + Vuetify 3 application with a Vanta animated background.</p>
              <v-btn class="mt-4 gradient-btn" to="/admin">
                Go to Admin Panel
              </v-btn>
              <v-btn class="mt-4 ml-2 gradient-btn" to="/auth/login">
                Go to User Login
              </v-btn>
            </v-col>
          </v-row>
        </v-container>
      </VMain>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import VantaBackground from '@/components/Base/VantaBackground.vue'

const currentYear = new Date().getFullYear()

definePageMeta({ layout: 'default' })
</script>

<style scoped>
.fallback-bg {
  height: 100vh;
  width: 100vw;
  background-color: #7ec0ee;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
}

.content-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.vanta-sky {
  color: #5ca6ca;
  text-shadow:
    1px 1px 2px #334d80,
    2px 2px 4px #000a,
    0 4px 12px #000a,
    0 1px 0 #fff8,
    0 0 16px #5ca6ca88;
  letter-spacing: 1px;
  font-weight: 900;
  font-size: 3rem;
}

.vanta-white {
  color: #3fa7d6; /* lighter blue shade */
  text-shadow:
    1px 1px 2px #334d80,
    2px 2px 4px #000a,
    0 2px 8px #5ca6ca88;
  font-size: 1.5rem;
}

.gradient-btn {
  background: linear-gradient(90deg, #3b82f6 0%, #a855f7 100%) !important;
  color: #fff !important;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px 0 rgba(80, 80, 160, 0.13);
}
</style>


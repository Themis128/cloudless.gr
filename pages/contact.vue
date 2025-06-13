<template>
  <VApp>
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
              <v-card>
                <v-card-title class="vanta-sky">Contact Us</v-card-title>
                <v-card-text>
                  <v-form>
                    <v-text-field label="Your Name" required />
                    <v-text-field label="Email" type="email" required />
                    <v-textarea label="Message" rows="4" required />
                    <v-btn color="primary" class="mt-4">Send Message</v-btn>
                  </v-form>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </VMain>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import VantaBackground from '@/components/Base/VantaBackground.vue'
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
  color: #3fa7d6;
  text-shadow:
    1px 1px 2px #334d80,
    2px 2px 4px #000a,
    0 2px 8px #5ca6ca88;
  font-size: 1.5rem;
}
</style>

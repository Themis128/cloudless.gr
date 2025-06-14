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
              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">What is Cloudless GR?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">A modular LLM dev agent built with Nuxt 3 and Supabase.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">Is it open-source?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">Parts of the platform may be open-sourced depending on community interest.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-col>
          </v-row>
        </v-container>
      </VMain>
    </div>
  </VApp>
</template>

<script setup lang="ts">
import VantaBackground from '~/components/Base/VantaBackground.vue'
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

/* Custom styling to match your Vanta theme */
.vanta-sky {
  color: #5ca6ca;
  font-weight: 600;
  font-size: 1.2rem;
  text-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.vanta-white {
  color: #ffffff;
  font-size: 1rem;
}
</style>

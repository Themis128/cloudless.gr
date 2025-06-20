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
        <v-container class="faq-container text-center py-8">
          <h1 class="faq-title vanta-sky mb-2" tabindex="0">Frequently Asked Questions</h1>
          <p class="faq-intro vanta-white mb-8" tabindex="0">
            Find answers to common questions about Cloudless GR, our LLM dev agent, and the platform's features.
          </p>
          <v-row justify="center">
            <v-col cols="12" md="8" lg="7">
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
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">How do I get started?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">Sign up for an account, then follow the onboarding steps to create your first project. Check the documentation for detailed guides.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">What LLMs are supported?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">Cloudless GR is designed to be model-agnostic. You can connect to popular LLMs like OpenAI, Ollama, and more, depending on your configuration.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">Is my data private?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">We take privacy seriously. Your data is stored securely and is never shared with third parties without your consent. See our Privacy Policy for details.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">How can I contribute or request a feature?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">We welcome feedback and contributions! Visit our GitHub or contact us through the platform to suggest features or report issues.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                  <v-expansion-panel-title class="vanta-sky">Where can I get support?</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <span class="vanta-white">Check our documentation, join the community chat, or reach out via the Contact Us page for help.</span>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-col>
          </v-row>
        </v-container>
      </VMain>
    </div>
    /* FAQ page enhancements */
    .faq-title {
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    }
    .faq-intro {
    font-size: 1.1rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    opacity: 0.85;
    }
    .faq-container {
    min-height: 80vh;
    }
  </VApp>
</template>

<script setup lang="ts">
import VantaBackground from '~/components/Base/VantaBackground.vue';
definePageMeta({ layout: 'info' })
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

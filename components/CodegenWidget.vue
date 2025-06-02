<template>
  <v-container :class="mobile ? 'pa-2' : 'pa-0'">
    <v-row justify="center">
      <v-col cols="12" class="text-center">
        <h1 :class="['font-weight-bold text-primary', mobile ? 'text-h4 mb-4' : 'text-h3 mb-8']">
          <span :class="{ 'd-none d-sm-inline': mobile }">AI Code Generation </span>Workspace
        </h1>
      </v-col>

      <v-col cols="12" sm="10" md="8" lg="6" xl="5">
        <v-card
          :class="['elevation-3 on-hover responsive-codegen-widget', mobile ? 'pa-4' : 'pa-6']"
          rounded="xl"
        >
          <v-form @submit.prevent="handleSend">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="prompt"
                  :disabled="loading"
                  placeholder="Ask the LLM anything..."
                  variant="outlined"
                  :loading="loading"
                  hide-details
                  :density="mobile ? 'compact' : 'comfortable'"
                  bg-color="grey-lighten-4"
                  class="rounded-lg responsive-prompt-field"
                  prepend-inner-icon="mdi-code-tags"
                >
                  <template v-slot:append>
                    <v-btn
                      color="primary"
                      :disabled="loading || !prompt"
                      icon="mdi-send"
                      @click="handleSend"
                      :size="mobile ? 'small' : 'default'"
                      class="responsive-send-btn"
                    ></v-btn>
                  </template>
                </v-text-field>
              </v-col>
            </v-row>
          </v-form>

          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            :class="mobile ? 'mt-3' : 'mt-4'"
            border="start"
            closable
            :density="mobile ? 'compact' : 'default'"
          >
            {{ error }}
          </v-alert>

          <v-card
            v-if="response"
            :class="[
              'bg-grey-lighten-5 responsive-response-card',
              mobile ? 'mt-3 pa-3' : 'mt-4 pa-4',
            ]"
            variant="flat"
            rounded="lg"
          >
            <v-card-text :class="['font-family-monospace', mobile ? 'text-body-2 pa-0' : 'pa-0']">
              {{ response }}
            </v-card-text>
          </v-card>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from '#imports';
import { useDisplay } from 'vuetify';

// Get display breakpoint information using Vuetify 3 composable
const { mobile } = useDisplay();

const prompt = ref('');

async function handleSend() {
  if (!prompt.value) return;
  // Logic to send prompt to the LLM and handle response
  prompt.value = '';
}
</script>

<style scoped>
/* Base responsive styles */
.responsive-codegen-widget {
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
  border-radius: 24px !important;
}

.responsive-codegen-widget:hover {
  box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.12) !important;
  transform: translateY(-2px);
}

/* Prompt field responsiveness */
.responsive-prompt-field {
  border-radius: 12px !important;
}

.responsive-send-btn {
  border-radius: 8px;
}

.responsive-response-card {
  border-radius: 12px !important;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* Font settings for monospace text */
.font-family-monospace {
  font-family: 'Fira Mono', Consolas, 'Courier New', monospace;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.4;
}

/* Mobile-specific optimizations */
@media (max-width: 599px) {
  .responsive-codegen-widget {
    border-radius: 16px !important;
    margin: 0 4px;
  }

  .responsive-prompt-field {
    border-radius: 8px !important;
  }

  .responsive-response-card {
    border-radius: 8px !important;
    max-height: 300px;
    overflow-y: auto;
  }

  .font-family-monospace {
    font-size: 0.875rem;
    line-height: 1.3;
  }

  .responsive-send-btn {
    min-width: 40px !important;
    min-height: 40px !important;
  }
}

/* Small mobile devices */
@media (max-width: 480px) {
  .responsive-codegen-widget {
    border-radius: 12px !important;
    margin: 0 2px;
  }

  .responsive-response-card {
    max-height: 250px;
  }

  .font-family-monospace {
    font-size: 0.8rem;
  }
}

/* Tablet optimizations */
@media (min-width: 600px) and (max-width: 959px) {
  .responsive-codegen-widget {
    border-radius: 20px !important;
  }

  .responsive-prompt-field {
    border-radius: 10px !important;
  }

  .responsive-response-card {
    border-radius: 10px !important;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .responsive-codegen-widget:hover {
    transform: none;
  }

  .responsive-send-btn {
    min-width: 48px !important;
    min-height: 48px !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .responsive-response-card {
    border: 2px solid rgba(0, 0, 0, 0.2);
  }

  .responsive-prompt-field {
    border: 2px solid rgba(0, 0, 0, 0.2);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .responsive-codegen-widget {
    transition: none;
  }

  .responsive-codegen-widget:hover {
    transform: none;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .responsive-response-card {
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>

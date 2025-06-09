<template>
  <v-container class="pa-0">
    <v-row justify="center">
      <v-col cols="12" class="text-center">
        <h1 class="text-h3 font-weight-bold text-primary mb-8">AI Code Generation Workspace</h1>
      </v-col>

      <v-col cols="12" sm="10" md="8" lg="6" xl="5">
        <v-card class="pa-6" elevation="3" :class="{ 'on-hover': true }" rounded="xl">
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
                  density="comfortable"
                  bg-color="grey-lighten-4"
                  class="rounded-lg"
                  prepend-inner-icon="mdi-code-tags"
                >
                  <template v-slot:append>
                    <v-btn
                      color="primary"
                      :disabled="loading || !prompt"
                      icon="mdi-send"
                      @click="handleSend"
                    ></v-btn>
                  </template>
                </v-text-field>
              </v-col>
            </v-row>
          </v-form>

          <v-alert v-if="error" type="error" variant="tonal" class="mt-4" border="start" closable>
            {{ error }}
          </v-alert>

          <v-card v-if="response" class="mt-4 pa-4 bg-grey-lighten-5" variant="flat" rounded="lg">
            <v-card-text class="font-family-monospace">
              {{ response }}
            </v-card-text>
          </v-card>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useLLMAndFileViewer } from '@/composables/useLLMAndFileViewer';
import { ref } from 'vue';

const prompt = ref('');
const { response, loading, error, sendPrompt } = useLLMAndFileViewer();

async function handleSend() {
  if (!prompt.value) return;
  await sendPrompt(prompt.value, () => {});
  prompt.value = '';
}
</script>

<style scoped>
/* Custom styles for hover effects */
.on-hover {
  transition: box-shadow 0.2s ease;
}
.on-hover:hover {
  box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.12) !important;
}

/* Font settings for monospace text */
.font-family-monospace {
  font-family: 'Fira Mono', Consolas, monospace;
}
</style>

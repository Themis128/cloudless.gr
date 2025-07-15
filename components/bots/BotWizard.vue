<template>
  <v-card>
    <v-card-title>Bot Builder Wizard</v-card-title>
    <v-progress-linear :value="progress" color="primary" height="6" class="mb-2" />
    <v-card-text>
      <v-stepper v-model="step" vertical>
        <!-- Step 1 -->
        <v-stepper-step :complete="form.name !== ''" step="1">Bot Identity</v-stepper-step>
        <v-stepper-content step="1">
          <v-text-field v-model="form.name" label="Bot Name" required :rules="[v => !!v || 'Name is required']" />
          <v-btn color="primary" :disabled="form.name === ''" @click="step++">Continue</v-btn>
        </v-stepper-content>

        <!-- Step 2 -->
        <v-stepper-step :complete="form.prompt !== ''" step="2">Instructions / Prompt</v-stepper-step>
        <v-stepper-content step="2">
          <v-textarea v-model="form.prompt" label="Prompt" auto-grow :rules="[v => !!v || 'Prompt is required']" />
          <v-btn class="me-2" @click="step--">Back</v-btn>
          <v-btn color="primary" :disabled="form.prompt === ''" @click="step++">Continue</v-btn>
        </v-stepper-content>

        <!-- Step 3 -->
        <v-stepper-step :complete="form.model !== ''" step="3">Model Choice</v-stepper-step>
        <v-stepper-content step="3">
          <v-select
            v-model="form.model"
            :items="models"
            label="Model"
            required
            :rules="[v => !!v || 'Model is required']"
          />
          <v-btn class="me-2" @click="step--">Back</v-btn>
          <v-btn color="primary" :disabled="form.model === ''" @click="step++">Continue</v-btn>
        </v-stepper-content>

        <!-- Step 4 -->
        <v-stepper-step step="4">Advanced Settings <v-chip color="info" size="small" class="ml-2">Optional</v-chip></v-stepper-step>
        <v-stepper-content step="4">
          <v-text-field v-model="form.memory" label="Memory Context">
            <template #append>
              <v-tooltip text="Context window for bot memory (optional)"><v-icon>mdi-help-circle</v-icon></v-tooltip>
            </template>
          </v-text-field>
          <v-text-field v-model="form.tools" label="Tools (comma-separated)">
            <template #append>
              <v-tooltip text="Comma-separated tool names (optional)"><v-icon>mdi-help-circle</v-icon></v-tooltip>
            </template>
          </v-text-field>
          <v-btn class="me-2" @click="step--">Back</v-btn>
          <v-btn color="primary" @click="step++">Summary</v-btn>
        </v-stepper-content>

        <!-- Step 5: Summary -->
        <v-stepper-step step="5">Summary & Confirmation</v-stepper-step>
        <v-stepper-content step="5">
          <v-list>
            <v-list-item><strong>Name:</strong> {{ form.name }}</v-list-item>
            <v-list-item><strong>Prompt:</strong> {{ form.prompt }}</v-list-item>
            <v-list-item><strong>Model:</strong> {{ form.model }}</v-list-item>
            <v-list-item><strong>Memory Context:</strong> {{ form.memory }}</v-list-item>
            <v-list-item><strong>Tools:</strong> {{ form.tools }}</v-list-item>
          </v-list>
          <v-btn class="me-2" @click="step--">Back</v-btn>
          <v-btn color="success" :loading="loading" @click="submitBot">Create Bot</v-btn>
        </v-stepper-content>
      </v-stepper>
    </v-card-text>

    <v-alert type="error" v-if="error" class="mt-2">{{ error }}</v-alert>
    <v-alert type="success" v-if="success" class="mt-2">Bot created successfully!</v-alert>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBotStore } from '~/stores/botStore'
import { useRouter } from 'vue-router'
import type { Bot } from '~/types/Bot'

const props = defineProps<{ template?: Partial<Bot> }>()

const emit = defineEmits(['created'])
const router = useRouter()
const botStore = useBotStore()
const { loading, success, error } = storeToRefs(botStore)

const step = ref(1)
const form = ref({
  name: props.template?.name || '',
  prompt: props.template?.prompt || '',
  model: props.template?.model || '',
  memory: props.template?.memory || '',
  tools: props.template?.tools || '',
})

const progress = computed(() => Math.round((step.value - 1) * 25))
const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3']

watch(success, (val) => {
  if (val) {
    step.value = 1
    form.value = {
      name: props.template?.name || '',
      prompt: props.template?.prompt || '',
      model: props.template?.model || '',
      memory: props.template?.memory || '',
      tools: props.template?.tools || '',
    }
    // Emit the created bot's data (assuming botStore.create returns the new bot)
    emit('created', botStore.bots[0])
    if (botStore.bots[0]?.id) {
      router.push(`/bots/${botStore.bots[0].id}`)
    } else {
      router.push('/bots')
    }
  }
})

async function submitBot() {
  await botStore.create({
    name: form.value.name,
    prompt: form.value.prompt,
    model: form.value.model,
    memory: form.value.memory,
    tools: form.value.tools,
  })
}
</script>

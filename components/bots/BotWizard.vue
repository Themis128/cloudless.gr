<template>
  <v-card>
    <v-card-title>Bot Builder Wizard</v-card-title>
    <v-progress-linear :value="progressValue" color="primary" height="6" class="mb-2" />
    <v-card-text>
      <VStepper v-model="step" class="mb-6" alt-labels aria-label="Bot Wizard Steps">
        <VStepperHeader>
          <template v-for="(s, idx) in steps" :key="s.title">
            <VStepperItem
              :complete="(idx === 0 && form.name !== '') || (idx === 1 && form.prompt !== '') || (idx === 2 && form.model !== '') || step > idx"
              :color="step === idx ? 'primary' : (step > idx ? 'success' : 'grey')"
              @click="step = idx"
              :title="s.title"
              :subtitle="s.subtitle"
            >
              <template #icon>
                <v-avatar :color="step === idx ? 'primary' : (step > idx ? 'success' : 'grey')" size="24">
                  <v-icon>{{ s.icon }}</v-icon>
                </v-avatar>
              </template>
            </VStepperItem>
          </template>
        </VStepperHeader>

        <!-- Step Content -->
        <div v-if="step === 0">
          <v-text-field v-model="form.name" label="Bot Name" required :rules="[v => !!v || 'Name is required']" />
          <VStepperActions class="mt-2">
            <v-btn color="primary" :disabled="form.name === ''" @click="step = step + 1">Continue</v-btn>
          </VStepperActions>
        </div>
        <div v-else-if="step === 1">
          <v-textarea v-model="form.prompt" label="Prompt" auto-grow :rules="[v => !!v || 'Prompt is required']" />
          <VStepperActions class="mt-2">
            <v-btn class="me-2" @click="step = step - 1">Back</v-btn>
            <v-btn color="primary" :disabled="form.prompt === ''" @click="step = step + 1">Continue</v-btn>
          </VStepperActions>
        </div>
        <div v-else-if="step === 2">
          <v-select
            v-model="form.model"
            :items="models"
            label="Model"
            required
            :rules="[v => !!v || 'Model is required']"
          />
          <VStepperActions class="mt-2">
            <v-btn class="me-2" @click="step = step - 1">Back</v-btn>
            <v-btn color="primary" :disabled="form.model === ''" @click="step = step + 1">Continue</v-btn>
          </VStepperActions>
        </div>
        <div v-else-if="step === 3">
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
          <VStepperActions class="mt-2">
            <v-btn class="me-2" @click="step = step - 1">Back</v-btn>
            <v-btn color="primary" @click="step = step + 1">Summary</v-btn>
          </VStepperActions>
        </div>
        <div v-else-if="step === 4">
          <v-list>
            <v-list-item>
              <template #default>
                <strong>Name:</strong> {{ form.name }}
              </template>
            </v-list-item>
            <v-list-item>
              <template #default>
                <strong>Prompt:</strong> {{ form.prompt }}
              </template>
            </v-list-item>
            <v-list-item>
              <template #default>
                <strong>Model:</strong> {{ form.model }}
              </template>
            </v-list-item>
            <v-list-item>
              <template #default>
                <strong>Memory Context:</strong> {{ form.memory }}
              </template>
            </v-list-item>
            <v-list-item>
              <template #default>
                <strong>Tools:</strong> {{ form.tools }}
              </template>
            </v-list-item>
          </v-list>
          <VStepperActions class="mt-2">
            <v-btn class="me-2" @click="step = step - 1">Back</v-btn>
            <v-btn color="success" :loading="loading" @click="submitBot">Create Bot</v-btn>
          </VStepperActions>
        </div>
      </VStepper>
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

const step = ref(0)
const form = ref({
  name: props.template?.name || '',
  prompt: props.template?.prompt || '',
  model: props.template?.model || '',
  memory: props.template?.memory || '',
  tools: props.template?.tools || '',
})

const stepIcons = [
  'mdi-account',
  'mdi-text-box-outline',
  'mdi-robot',
  'mdi-tune',
  'mdi-check-circle-outline'
]
const totalSteps = 5
const progressValue = computed(() => ((step.value + 1) / totalSteps) * 100)
const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3']

const steps = computed(() => [
  { title: 'Name', subtitle: 'Bot Name', icon: stepIcons[0] },
  { title: 'Prompt', subtitle: 'Bot Prompt', icon: stepIcons[1] },
  { title: 'Model', subtitle: 'Select Model', icon: stepIcons[2] },
  { title: 'Settings', subtitle: 'Memory & Tools', icon: stepIcons[3] },
  { title: 'Summary', subtitle: 'Review & Create', icon: stepIcons[4] },
])

watch(success, (val) => {
  if (val) {
    step.value = 0
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

<style scoped>
.stepper-item {
  cursor: pointer;
}
</style>

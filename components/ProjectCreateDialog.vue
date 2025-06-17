<template>
  <v-dialog v-model="show" max-width="600px" scrollable>
    <v-card>
      <v-card-title class="text-h5 pa-6">
        Create New Project
      </v-card-title>

      <v-card-text class="px-6">
        <v-form v-model="valid" @submit.prevent="createProject">
          <v-text-field
            v-model="form.name"
            label="Project Name"
            :rules="[rules.required]"
            required
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="form.description"
            label="Description"
            variant="outlined"
            rows="3"
            class="mb-4"
          />

          <v-select
            v-model="form.type"
            :items="projectTypes"
            label="Project Type"
            :rules="[rules.required]"
            required
            variant="outlined"
            class="mb-4"
          />

          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ error }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-6">
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="loading"
          @click="cancel"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!valid"
          @click="createProject"
        >
          Create Project
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': [project: any]
}>()

const projectsStore = useProjectsStore()

// Form state
const form = ref({
  name: '',
  description: '',
  type: 'classification' as const
})

const valid = ref(false)
const loading = ref(false)
const error = ref('')

// Computed
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Project types
const projectTypes = [
  { title: 'Classification', value: 'classification' },
  { title: 'Regression', value: 'regression' },
  { title: 'Clustering', value: 'clustering' },
  { title: 'Natural Language Processing', value: 'nlp' },
  { title: 'Computer Vision', value: 'cv' },
  { title: 'Recommendation', value: 'recommendation' },
  { title: 'Time Series', value: 'time-series' },
  { title: 'Custom', value: 'custom' }
]

// Validation rules
const rules = {
  required: (value: string) => !!value || 'This field is required'
}

// Methods
const createProject = async () => {
  if (!valid.value) return

  try {
    loading.value = true
    error.value = ''
    
    const project = await projectsStore.createProject({
      name: form.value.name,
      description: form.value.description,
      type: form.value.type
    })

    emit('created', project)
    resetForm()
  } catch (err: any) {
    error.value = err.message || 'Failed to create project'
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  show.value = false
  resetForm()
}

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    type: 'classification'
  }
  valid.value = false
  error.value = ''
}

// Reset form when dialog closes
watch(show, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>

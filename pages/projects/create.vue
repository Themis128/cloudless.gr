<template>
  <div>
    <ProjectGuide />
    <v-container>
      <h1 class="mb-4">
        <v-icon size="32" class="mr-3">
          mdi-folder-plus
        </v-icon>
        Create Project
      </h1>
      
      <v-card>
        <v-card-title class="text-h6">
          Project Details
        </v-card-title>
        <v-card-text>
          <v-form class="create-form" @submit.prevent="createProject">
            <v-text-field
              v-model="form.name"
              label="Project Name"
              class="form-field"
              required
            />
            <v-textarea
              v-model="form.description"
              label="Description"
              class="form-field"
              rows="3"
            />
            <v-select
              v-model="form.type"
              :items="projectTypes"
              label="Project Type"
              class="form-field"
              required
            />
            <v-text-field
              v-model="form.version"
              label="Version"
              class="form-field"
              required
            />
            <v-select
              v-model="form.visibility"
              :items="visibilityOptions"
              label="Visibility"
              class="form-field"
              required
            />
            
            <div class="form-actions">
              <v-btn
                type="submit"
                color="primary"
                :loading="loading"
                size="large"
              >
                <v-icon start>
                  mdi-plus
                </v-icon>
                Create Project
              </v-btn>
              <v-btn
                text
                class="ml-2"
                size="large"
                @click="resetForm"
              >
                <v-icon start>
                  mdi-refresh
                </v-icon>
                Reset
              </v-btn>
            </div>
          </v-form>
          
          <v-alert v-if="success" type="success" class="mt-4">
            <v-icon start>
              mdi-check-circle
            </v-icon>
            Project created successfully!
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            <v-icon start>
              mdi-alert-circle
            </v-icon>
            {{ error }}
          </v-alert>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const projectTypes = [
  'Machine Learning',
  'Data Science',
  'Web Application',
  'API Development',
  'Research',
  'Custom'
]

const visibilityOptions = ['public', 'private', 'team']

const form = ref({
  name: '',
  description: '',
  type: '',
  version: '1.0.0',
  visibility: 'private',
})

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    type: '',
    version: '1.0.0',
    visibility: 'private',
  }
  success.value = false
  error.value = null
}

const createProject = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const { error: err } = await supabase.from('projects').insert([
      {
        name: form.value.name,
        description: form.value.description,
        type: form.value.type,
        version: form.value.version,
        visibility: form.value.visibility,
        created_at: new Date().toISOString(),
        status: 'active',
      },
    ])
    
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      resetForm()
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-form {
  margin-bottom: 2rem;
}

.form-field {
  margin-bottom: 1.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .v-btn {
    width: 100%;
  }
}
</style>

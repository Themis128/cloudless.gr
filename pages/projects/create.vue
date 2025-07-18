<template>
  <div>
    <v-btn icon class="mb-4" to="/projects">
      <v-icon> mdi-arrow-left </v-icon>
    </v-btn>

    <div
      v-if="wizard.current.value && wizard.current.value.description"
      class="mb-4"
    >
      <v-alert type="info" border="start" variant="tonal" class="mb-4">
        <div v-text="wizard.current.value.description" />
      </v-alert>
    </div>
    <ProjectGuide />
    <!-- Onboarding Modal -->
    <v-dialog v-model="showOnboarding" max-width="500" persistent>
      <v-card>
        <v-card-title>Welcome to the Project Wizard</v-card-title>
        <v-card-text>
          This wizard will guide you through creating and managing your project
          step by step.<br />
          <ul>
            <li>Follow the steps below and use the navigation buttons.</li>
            <li>
              Click the help icon
              <v-icon small color="primary"> mdi-help-circle </v-icon> for more
              info on each step.
            </li>
          </ul>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showOnboarding = false">
            Get Started
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <VStepper
      v-model="wizard.currentStep.value"
      class="mb-6"
      alt-labels
      aria-label="Wizard steps"
    >
      <VStepperHeader>
        <VStepperItem
          v-for="(step, idx) in wizard.steps"
          :key="step.title + idx"
          :complete="wizard.currentStep.value > idx"
          :value="idx"
          :aria-current="wizard.currentStep.value === idx ? 'step' : undefined"
          :tabindex="wizard.currentStep.value === idx ? 0 : -1"
          :color="
            wizard.currentStep.value === idx
              ? 'primary'
              : wizard.currentStep.value > idx
                ? 'success'
                : 'grey'
          "
          class="stepper-item"
          @click="() => wizard.goTo(idx)"
        >
          <template #icon>
            <v-avatar
              :color="
                wizard.currentStep.value === idx
                  ? 'primary'
                  : wizard.currentStep.value > idx
                    ? 'success'
                    : 'grey'
              "
              size="24"
            >
              <span class="white--text">{{ idx + 1 }}</span>
            </v-avatar>
          </template>
          <span>{{ step.title }}</span>
          <v-tooltip activator="parent" location="top">
            {{ step.subtitle }}
          </v-tooltip>
          <div class="text-caption text-secondary">
            {{ step.subtitle }}
          </div>
        </VStepperItem>
      </VStepperHeader>
    </VStepper>
    <div class="mb-2 text-right">
      <span class="text-caption"
        >Step {{ wizard.currentStep.value + 1 }} of {{ wizard.stepCount }}</span
      >
    </div>
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <v-card>
            <v-card-title>
              Create Project
              <v-btn
                icon
                size="small"
                class="ml-2"
                aria-label="Help"
                @click="showHelp = true"
              >
                <v-icon>mdi-help-circle</v-icon>
              </v-btn>
            </v-card-title>
            <v-card-text>
              <div class="mb-4">
                <div>
                  Use the template below to create a new project. Fill in the
                  fields and click 'Create Project'.
                </div>
                <v-code>
                  { "name": "MyProject", "description": "Project description" }
                </v-code>
              </div>
              <v-form
                ref="formRef"
                aria-label="Project creation form"
                @submit.prevent="onSubmit"
              >
                <v-text-field
                  v-model="name"
                  label="Name"
                  placeholder="e.g. MyProject"
                  required
                  class="mb-3"
                  :error-messages="nameError ? [nameError] : []"
                  autofocus
                  aria-required="true"
                  aria-describedby="name-desc"
                />
                <div id="name-desc" class="text-caption mb-2">
                  Project name must be unique and descriptive.
                </div>
                <v-text-field
                  v-model="description"
                  label="Description"
                  placeholder="Project description"
                  class="mb-3"
                  :error-messages="descError ? [descError] : []"
                  aria-describedby="desc-desc"
                />
                <div id="desc-desc" class="text-caption mb-2">
                  Describe the purpose of your project (optional).
                </div>
                <v-row class="mt-4">
                  <v-col cols="6">
                    <v-btn
                      color="secondary"
                      variant="outlined"
                      :disabled="wizard.isFirstStep.value"
                      @click="wizard.prev"
                    >
                      <v-icon start> mdi-arrow-left </v-icon> Back
                    </v-btn>
                  </v-col>
                  <v-col cols="6" class="text-right">
                    <v-btn
                      color="primary"
                      variant="elevated"
                      :disabled="!canProceed"
                      @click="wizard.isLastStep ? onSubmit() : wizard.next"
                    >
                      <span v-if="!wizard.isLastStep"
                        >Next <v-icon end>mdi-arrow-right</v-icon></span
                      >
                      <span v-else>Submit <v-icon end>mdi-check</v-icon></span>
                    </v-btn>
                  </v-col>
                </v-row>
              </v-form>
              <v-snackbar
                v-model="showSnackbar"
                :color="snackbarColor"
                :timeout="4000"
              >
                {{ snackbarMsg }}
              </v-snackbar>
              <v-dialog v-model="showHelp" max-width="400">
                <v-card>
                  <v-card-title>Help</v-card-title>
                  <v-card-text>
                    Enter a unique project name and (optionally) a description.
                    Use the navigation buttons to move between steps. For more
                    info, see the documentation.
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer />
                    <v-btn color="primary" @click="showHelp = false">
                      Close
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-dialog>
              <v-alert
                v-if="success"
                type="success"
                class="mt-3"
                aria-live="polite"
              >
                Project created!
              </v-alert>
              <v-alert
                v-if="error"
                type="error"
                class="mt-3"
                aria-live="assertive"
              >
                {{ error }}
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <v-btn icon class="mb-4" to="/" aria-label="Back to home">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'
import { useWizard } from '~/composables/useWizard'
import { useProjectStore } from '~/stores/templateStore'

const formRef = ref()
const projectStore = useProjectStore()
const { name, description, loading, success, error } = storeToRefs(projectStore)

// Wizard stepper integration
const wizard = useWizard()

// Onboarding/help
const showOnboarding = ref(true)
const showHelp = ref(false)

// Inline validation
const nameError = ref('')
const descError = ref('')
const showSnackbar = ref(false)
const snackbarMsg = ref('')
const snackbarColor = ref('success')

const canProceed = computed(() => {
  return name.value && !nameError.value
})

watch(name, val => {
  if (!val) nameError.value = 'Project name is required.'
  else if (val.length < 3)
    nameError.value = 'Name must be at least 3 characters.'
  else nameError.value = ''
})

watch(description, val => {
  if (val && val.length > 200) descError.value = 'Description too long.'
  else descError.value = ''
})

const onSubmit = () => {
  if (!canProceed.value) {
    showSnackbar.value = true
    snackbarMsg.value = 'Please fix errors before continuing.'
    snackbarColor.value = 'error'
    return
  }
  projectStore.create({ name: name.value, description: description.value })
  showSnackbar.value = true
  snackbarMsg.value = 'Project submitted!'
  snackbarColor.value = 'success'
}
</script>

<style scoped>
.mb-3 {
  margin-bottom: 1rem;
}
.mt-3 {
  margin-top: 1rem;
}
</style>

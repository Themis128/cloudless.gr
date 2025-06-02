<!--
  AgentForm.vue
  - Main agent creation/editing form (used in new.vue and edit flows)
  - Fields: agent name, description, goals, tools, model selection, permissions
  - Validation, autosave, and versioning logic (placeholders)
  - Security: Enforce user permissions for editing (see setup script)
-->
<template>
  <v-form ref="formRef" v-model="formValid" lazy-validation>
    <v-text-field
      v-model="agent.name"
      label="Agent Name"
      :rules="[rules.required]"
      required
      class="mb-4"
    />
    <v-textarea
      v-model="agent.description"
      label="Description"
      :rules="[rules.required]"
      required
      class="mb-4"
    />
    <v-textarea
      v-model="agent.goals"
      label="Goals (comma-separated)"
      :rules="[rules.required]"
      required
      class="mb-4"
    />
    <v-combobox
      v-model="agent.tools"
      :items="availableTools"
      label="Tools"
      multiple
      chips
      class="mb-4"
    />
    <v-select
      v-model="agent.model"
      :items="availableModels"
      label="Model Selection"
      :rules="[rules.required]"
      required
      class="mb-4"
    />
    <v-select
      v-model="agent.permissions"
      :items="availablePermissions"
      label="Permissions"
      multiple
      chips
      class="mb-4"
    />
    <v-btn color="primary" @click="submitForm" :disabled="!formValid || !canEdit">
      Save Agent
    </v-btn>
    <v-alert v-if="!canEdit" type="warning" class="mt-4">
      You do not have permission to edit this agent.
    </v-alert>
    <v-alert v-if="error" type="error" class="mt-4">
      {{ error }}
    </v-alert>
    <v-alert v-if="success" type="success" class="mt-4">
      {{ success }}
    </v-alert>
  </v-form>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports';
import { useAgents } from '~/composables/useAgents';
import { useAuth } from '~/composables/useAuth';

const props = defineProps<{ agentData?: any }>();

import type { PermissionType } from '~/types/permissions'; // Adjust the import path as needed

const { hasPermission } = useAuth();
const canEdit = computed(() => hasPermission('edit_agents' as PermissionType));

const formRef = ref();
const formValid = ref(true);
const error = ref('');
const success = ref('');

const agent = ref({
  name: '',
  description: '',
  goals: '',
  tools: [],
  model: '',
  permissions: [],
});

// Populate form if editing
if (props.agentData) {
  agent.value = { ...props.agentData };
}

const availableTools = ref([
  'Web Search',
  'File Upload',
  'Database Access',
  'Email',
]);
const availableModels = ref([
  'gpt-4',
  'gpt-3.5-turbo',
  'llama-2',
  'custom',
]);
const availablePermissions = ref([
  'read',
  'write',
  'admin',
]);

const rules = {
  required: (v: string) => !!v || 'This field is required',
};

const { saveAgent, updateAgent } = useAgents();

function submitForm() {
  if (!canEdit.value) {
    error.value = 'You do not have permission to edit this agent.';
    return;
  }
  if (formRef.value?.validate()) {
    try {
      if (props.agentData && props.agentData.id) {
        // Edit mode
        updateAgent(props.agentData.id, agent.value).then(() => {
          success.value = 'Agent updated successfully.';
          error.value = '';
        }).catch((e) => {
          error.value = e?.data?.message || 'Failed to update agent.';
          success.value = '';
        });
      } else {
        // Create mode
        saveAgent(agent.value).then(() => {
          success.value = 'Agent created successfully.';
          error.value = '';
        }).catch((e) => {
          error.value = e?.data?.message || 'Failed to create agent.';
          success.value = '';
        });
      }
    } catch (e: any) {
      error.value = e?.data?.message || 'Error saving agent.';
      success.value = '';
    }
  } else {
    error.value = 'Please fix validation errors.';
    success.value = '';
  }
}

// TODO: Add autosave/versioning logic here
// watch(agent, (newVal) => { ... })
</script>

&lt;template> &lt;v-form @submit.prevent="handleSubmit" v-model="isValid"> &lt;v-card>
&lt;v-card-title>{{ isEditing ? 'Edit Agent' : 'Create New Agent' }}&lt;/v-card-title>
&lt;v-card-text> &lt;v-container> &lt;v-row> &lt;v-col cols="12"> &lt;v-text-field
v-model="form.name" label="Agent Name" required :rules="[v => !!v || 'Name is required']"
>&lt;/v-text-field> &lt;/v-col> &lt;v-col cols="12"> &lt;v-textarea v-model="form.description"
label="Description" required :rules="[v => !!v || 'Description is required']" >&lt;/v-textarea>
&lt;/v-col> &lt;v-col cols="12" md="6"> &lt;v-select v-model="form.model" :items="availableModels"
label="Base Model" required :rules="[v => !!v || 'Model is required']" >&lt;/v-select> &lt;/v-col>
&lt;v-col cols="12" md="6"> &lt;v-select v-model="form.memoryType" :items="memoryTypes"
label="Memory Type" required :rules="[v => !!v || 'Memory type is required']" >&lt;/v-select>
&lt;/v-col> &lt;v-col cols="12"> &lt;v-textarea v-model="form.systemPrompt" label="System Prompt"
required :rules="[v => !!v || 'System prompt is required']" >&lt;/v-textarea> &lt;/v-col>
&lt;/v-row> &lt;/v-container> &lt;/v-card-text> &lt;v-card-actions> &lt;v-spacer>&lt;/v-spacer>
&lt;v-btn color="primary" type="submit" :loading="loading" :disabled="!isValid" >
{{ isEditing ? 'Update Agent' : 'Create Agent' }}
&lt;/v-btn> &lt;/v-card-actions> &lt;/v-card> &lt;/v-form> &lt;/template> &lt;script setup
lang="ts"> import { ref, computed } from 'vue' import type { Agent } from '~/types/agents' const
props = defineProps<{ agent?: Agent loading?: boolean }>() const emit = defineEmits<{ (e: 'submit',
agent: Partial
<Agent></Agent>

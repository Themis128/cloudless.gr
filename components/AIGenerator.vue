<template>
  <div class="ai-generator">
    <form @submit.prevent="handleGenerate" class="space-y-4">
      <!-- Input Textarea -->
      <div>
        <label for="prompt" class="block text-sm font-medium mb-2">
          What would you like to generate?
        </label>
        <textarea
          id="prompt"
          v-model="userPrompt"
          :disabled="loading"
          rows="4"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          placeholder="E.g., 'Write a catchy tagline for a design tool'"
        />
      </div>

      <!-- Model Selection -->
      <div>
        <label for="model" class="block text-sm font-medium mb-2">
          Model
        </label>
        <select
          id="model"
          v-model="selectedModel"
          :disabled="loading"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="@cf/meta/llama-3-8b-instruct">Llama 3 (8B) - Fast</option>
          <option value="@cf/meta/llama-3-70b-instruct">Llama 3 (70B) - Slower but better</option>
        </select>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="loading || !userPrompt.trim()"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
      >
        {{ loading ? 'Generating...' : 'Generate' }}
      </button>
    </form>

    <!-- Error Display -->
    <div v-if="error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-700 font-medium">Error</p>
      <p class="text-red-600 text-sm">{{ error }}</p>
    </div>

    <!-- Result Display -->
    <div v-if="result" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
      <p class="text-sm text-gray-600 font-medium mb-2">Generated Result:</p>
      <p class="text-gray-900 whitespace-pre-wrap">{{ result }}</p>
      <button
        @click="copyToClipboard"
        class="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        Copy
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const userPrompt = ref('')
const selectedModel = ref('@cf/meta/llama-3-8b-instruct')

const { loading, error, result, generate } = useWorkersAI()

const handleGenerate = async () => {
  await generate(userPrompt.value, selectedModel.value)
}

const copyToClipboard = () => {
  if (result.value) {
    navigator.clipboard.writeText(result.value)
  }
}
</script>

<style scoped>
.ai-generator {
  max-width: 600px;
  margin: 0 auto;
}
</style>

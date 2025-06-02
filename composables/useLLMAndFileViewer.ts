import { ref } from '#imports';
import { generateLLMResponse } from '../utils/codeLlama';

interface LLMOptions {
  endpoint?: string;
}

export function useLLMAndFileViewer(
  llmOptions: LLMOptions = {},
  defaultFilePath = 'components/CodegenWidget.vue'
) {
  // LLM logic
  const response = ref('');
  const loading = ref(false);
  const error = ref('');
  const endpoint = llmOptions.endpoint;

  async function sendPrompt(prompt: string, onData: (data: string) => void) {
    loading.value = true;
    error.value = '';
    response.value = '';
    try {
      response.value = await generateLLMResponse(prompt, onData, endpoint);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
    return response.value;
  }

  // File viewer logic
  const filePath = ref(defaultFilePath);
  const fileContent = ref('');
  const fileLoading = ref(false);
  const fileError = ref('');

  async function loadFile(path?: string) {
    fileLoading.value = true;
    fileError.value = '';
    fileContent.value = '';
    if (path) filePath.value = path;
    try {
      const res = await fetch(`/api/load-file?path=${encodeURIComponent(filePath.value)}`);
      const data = await res.json();
      if (data.error) {
        fileError.value = data.error;
      } else {
        fileContent.value = data;
      }
    } catch {
      fileError.value = 'Failed to load file.';
    } finally {
      fileLoading.value = false;
    }
  }

  return {
    // LLM
    response,
    loading,
    error,
    sendPrompt,
    // File viewer
    filePath,
    fileContent,
    fileLoading,
    fileError,
    loadFile,
  };
}

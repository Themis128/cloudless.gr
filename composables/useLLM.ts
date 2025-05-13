// Portable composable for LLM integration
import { generateLLMResponse } from "@/utils/codeLlama";
import { ref } from "vue";

interface LLMOptions {
  endpoint?: string;
}

export function useLLM(options: LLMOptions = {}) {
  const response = ref("");
  const loading = ref(false);
  const error = ref("");

  // Accept endpoint override for portability
  const endpoint = options.endpoint;

  async function sendPrompt(prompt: string, onData: (data: string) => void) {
    loading.value = true;
    error.value = "";
    response.value = "";
    try {
      response.value = await generateLLMResponse(prompt, onData, endpoint);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
    return response.value;
  }

  return {
    response,
    loading,
    error,
    sendPrompt,
  };
}

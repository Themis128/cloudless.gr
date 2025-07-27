import { computed } from 'vue'

interface LLMOptions {
  endpoint?: string
}

// Composable that uses the Pinia store
export function useLLMAndFileViewer(
  llmOptions: LLMOptions = {},
  defaultFilePath = 'components/CodegenWidget.vue'
) {
  const llmFileViewerStore = useLLMFileViewerStore()

  // Initialize with options
  llmFileViewerStore.setLLMOptions(llmOptions)
  llmFileViewerStore.setDefaultFilePath(defaultFilePath)

  // Return readonly state and computed properties for backward compatibility
  return {
    // LLM (readonly for backward compatibility)
    response: computed(() => llmFileViewerStore.llmResponse),
    loading: computed(() => llmFileViewerStore.llmLoading),
    error: computed(() => llmFileViewerStore.llmError),
    endpoint: computed(() => llmFileViewerStore.llmEndpoint),

    // File viewer (readonly for backward compatibility)
    filePath: computed(() => llmFileViewerStore.filePath),
    fileContent: computed(() => llmFileViewerStore.fileContent),
    fileLoading: computed(() => llmFileViewerStore.fileLoading),
    fileError: computed(() => llmFileViewerStore.fileError),

    // Methods (delegate to store)
    sendPrompt: llmFileViewerStore.sendPrompt,
    loadFile: llmFileViewerStore.loadFile,

    // Additional store methods
    setLLMOptions: llmFileViewerStore.setLLMOptions,
    setDefaultFilePath: llmFileViewerStore.setDefaultFilePath,
    clearLLMResponse: llmFileViewerStore.clearLLMResponse,
    clearFileContent: llmFileViewerStore.clearFileContent,
    clearAll: llmFileViewerStore.clearAll,
    setLLMError: llmFileViewerStore.setLLMError,
    setFileError: llmFileViewerStore.setFileError,
    updateFileContent: llmFileViewerStore.updateFileContent,
    updateLLMResponse: llmFileViewerStore.updateLLMResponse,
    getFileInfo: llmFileViewerStore.getFileInfo,
    getLLMInfo: llmFileViewerStore.getLLMInfo,

    // Additional computed properties from store
    hasLLMResponse: computed(() => llmFileViewerStore.hasLLMResponse),
    hasFileContent: computed(() => llmFileViewerStore.hasFileContent),
    hasLLMError: computed(() => llmFileViewerStore.hasLLMError),
    hasFileError: computed(() => llmFileViewerStore.hasFileError),
    isLLMReady: computed(() => llmFileViewerStore.isLLMReady),
    isFileReady: computed(() => llmFileViewerStore.isFileReady),
  }
}

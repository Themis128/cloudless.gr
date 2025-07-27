import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateLLMResponse } from '@/utils/codeLlama'

interface LLMOptions {
  endpoint?: string
}

interface FileViewerState {
  filePath: string
  fileContent: string
  fileLoading: boolean
  fileError: string
}

interface LLMState {
  response: string
  loading: boolean
  error: string
  endpoint?: string
}

export const useLLMFileViewerStore = defineStore('llmFileViewer', () => {
  // LLM State
  const llmState = ref<LLMState>({
    response: '',
    loading: false,
    error: '',
    endpoint: undefined
  })

  // File Viewer State
  const fileViewerState = ref<FileViewerState>({
    filePath: 'components/CodegenWidget.vue',
    fileContent: '',
    fileLoading: false,
    fileError: ''
  })

  // Computed properties
  const hasLLMResponse = computed(() => llmState.value.response.length > 0)
  const hasFileContent = computed(() => fileViewerState.value.fileContent.length > 0)
  const hasLLMError = computed(() => llmState.value.error.length > 0)
  const hasFileError = computed(() => fileViewerState.value.fileError.length > 0)
  const isLLMReady = computed(() => !llmState.value.loading && !llmState.value.error)
  const isFileReady = computed(() => !fileViewerState.value.fileLoading && !fileViewerState.value.fileError)

  // Actions
  const setLLMOptions = (options: LLMOptions) => {
    llmState.value.endpoint = options.endpoint
  }

  const setDefaultFilePath = (path: string) => {
    fileViewerState.value.filePath = path
  }

  const sendPrompt = async (prompt: string, onData?: (data: string) => void) => {
    llmState.value.loading = true
    llmState.value.error = ''
    llmState.value.response = ''

    try {
      llmState.value.response = await generateLLMResponse(
        prompt, 
        onData || (() => {}), 
        llmState.value.endpoint
      )
      return llmState.value.response
    } catch (e) {
      llmState.value.error = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      llmState.value.loading = false
    }
  }

  const loadFile = async (path?: string) => {
    fileViewerState.value.fileLoading = true
    fileViewerState.value.fileError = ''
    fileViewerState.value.fileContent = ''

    if (path) {
      fileViewerState.value.filePath = path
    }

    try {
      const res = await fetch(`/api/load-file?path=${encodeURIComponent(fileViewerState.value.filePath)}`)
      const data = await res.json()
      
      if (data.error) {
        fileViewerState.value.fileError = data.error
        throw new Error(data.error)
      } else {
        fileViewerState.value.fileContent = data
      }
    } catch (e) {
      fileViewerState.value.fileError = 'Failed to load file.'
      throw e
    } finally {
      fileViewerState.value.fileLoading = false
    }
  }

  const clearLLMResponse = () => {
    llmState.value.response = ''
    llmState.value.error = ''
  }

  const clearFileContent = () => {
    fileViewerState.value.fileContent = ''
    fileViewerState.value.fileError = ''
  }

  const clearAll = () => {
    clearLLMResponse()
    clearFileContent()
  }

  const setLLMError = (error: string) => {
    llmState.value.error = error
  }

  const setFileError = (error: string) => {
    fileViewerState.value.fileError = error
  }

  const updateFileContent = (content: string) => {
    fileViewerState.value.fileContent = content
  }

  const updateLLMResponse = (response: string) => {
    llmState.value.response = response
  }

  const getFileInfo = () => {
    return {
      path: fileViewerState.value.filePath,
      contentLength: fileViewerState.value.fileContent.length,
      hasContent: hasFileContent.value,
      hasError: hasFileError.value
    }
  }

  const getLLMInfo = () => {
    return {
      hasResponse: hasLLMResponse.value,
      hasError: hasLLMError.value,
      responseLength: llmState.value.response.length,
      endpoint: llmState.value.endpoint
    }
  }

  return {
    // LLM State
    llmResponse: computed(() => llmState.value.response),
    llmLoading: computed(() => llmState.value.loading),
    llmError: computed(() => llmState.value.error),
    llmEndpoint: computed(() => llmState.value.endpoint),

    // File Viewer State
    filePath: computed(() => fileViewerState.value.filePath),
    fileContent: computed(() => fileViewerState.value.fileContent),
    fileLoading: computed(() => fileViewerState.value.fileLoading),
    fileError: computed(() => fileViewerState.value.fileError),

    // Computed properties
    hasLLMResponse,
    hasFileContent,
    hasLLMError,
    hasFileError,
    isLLMReady,
    isFileReady,

    // Actions
    setLLMOptions,
    setDefaultFilePath,
    sendPrompt,
    loadFile,
    clearLLMResponse,
    clearFileContent,
    clearAll,
    setLLMError,
    setFileError,
    updateFileContent,
    updateLLMResponse,
    getFileInfo,
    getLLMInfo
  }
}) 
// File: src/hooks/useWorkersAI.ts
// Next.js Hook for consuming Cloudflare Workers AI

'use client'

import { ref, readonly } from 'vue'

interface GenerateResponse {
  success: boolean
  result: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
}

export const useWorkersAI = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<string | null>(null)

  const generate = async (prompt: string, model?: string) => {
    loading.value = true
    error.value = null
    result.value = null

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model
        })
      })

      const data = await response.json() as Partial<GenerateResponse> & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate')
      }

      if (data.success) {
        result.value = data.result || null
        return data
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred'
      console.error('AI generation error:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    result: readonly(result),
    generate
  }
}

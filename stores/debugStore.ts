import { defineStore } from 'pinia'

export const useDebugStore = defineStore('debug', {
  state: () => ({
    logs: [] as string[],
    diagnostics: {} as Record<string, any>
  }),
  actions: {
    addLog(entry: string) {
      this.logs.push(`[${new Date().toISOString()}] ${entry}`)
    },
    setDiagnostics(data: Record<string, any>) {
      this.diagnostics = data
    }
  }
})

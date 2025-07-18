import { computed } from 'vue'
import { useDebugStore } from '~/stores/debugStore'

export const useDebugTools = () => {
  const debugStore = useDebugStore()

  // Logs and diagnostics from Pinia store
  const logs = computed(() => debugStore.logs)
  const diagnostics = computed(() => debugStore.diagnostics)

  // Add a log entry
  const addLog = (entry: string) => {
    debugStore.addLog(entry)
  }

  // Set diagnostics
  const setDiagnostics = (data: Record<string, any>) => {
    debugStore.setDiagnostics(data)
  }

  // Command handler for DebugConsole
  const handleCommand = (cmd: string) => {
    addLog('> ' + cmd)
    // Example: echo command
    if (cmd.startsWith('echo ')) {
      addLog(cmd.slice(5))
    } else {
      addLog('[unknown command] ' + cmd)
    }
  }

  return {
    logs,
    diagnostics,
    addLog,
    setDiagnostics,
    handleCommand
  }
}

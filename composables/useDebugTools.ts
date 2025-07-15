import { computed } from 'vue'
import { useDebugStore } from '~/stores/debugStore'

export function useDebugTools() {
  const debugStore = useDebugStore()

  // Logs and diagnostics from Pinia store
  const logs = computed(() => debugStore.logs)
  const diagnostics = computed(() => debugStore.diagnostics)

  // Add a log entry
  function addLog(entry: string) {
    debugStore.addLog(entry)
  }

  // Set diagnostics
  function setDiagnostics(data: Record<string, any>) {
    debugStore.setDiagnostics(data)
  }

  // Command handler for DebugConsole
  function handleCommand(cmd: string) {
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

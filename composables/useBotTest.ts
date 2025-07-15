import { ref, watch } from 'vue'

export function useBotTest(botId: string | number) {
  const input = ref('')
  const messages = ref<{ id: number; role: string; text: string }[]>([])
  const steps = ref<any[]>([])
  const progress = ref(0)
  let msgId = 1

  async function sendMessage() {
    if (!input.value) return
    const userMsg = input.value
    messages.value.push({ id: msgId++, role: 'user', text: userMsg })
    input.value = ''
    steps.value = []
    progress.value = 0
    try {
      const res = await fetch(`/api/bots/${botId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      })
      const data = await res.json()
      if (data.response) {
        messages.value.push({ id: msgId++, role: 'bot', text: data.response })
      } else {
        messages.value.push({ id: msgId++, role: 'bot', text: data.error || 'No response from bot.' })
      }
      if (Array.isArray(data.steps)) {
        steps.value = data.steps.map((s: any) => ({ ...s }))
        progress.value = 0
        // Simulate real-time updates for each step
        let current = 0
        function updateStep() {
          if (current > 0) {
            steps.value[current - 1].status = 'complete'
            steps.value[current - 1].result = `Step '${steps.value[current - 1].name}' completed.`
          }
          if (current < steps.value.length) {
            steps.value[current].status = 'running'
            steps.value[current].result = `Step '${steps.value[current].name}' started.`
            progress.value = ((current + 1) / steps.value.length) * 100
            current++
            setTimeout(updateStep, 1200)
          } else {
            progress.value = 100
          }
        }
        // Initialize all steps to pending except first
        steps.value.forEach((s: any, idx: number) => {
          s.status = idx === 0 ? 'running' : 'pending'
          s.result = idx === 0 ? `Step '${s.name}' started with input: ${userMsg}` : null
        })
        setTimeout(updateStep, 1200)
      }
    } catch (err) {
      messages.value.push({ id: msgId++, role: 'bot', text: 'Error contacting bot API.' })
    }
  }

  function reset() {
    messages.value = []
    msgId = 1
  }

  return {
    input,
    messages,
    steps,
    progress,
    sendMessage,
    reset
  }
}

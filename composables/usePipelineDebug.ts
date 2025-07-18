import { ref } from 'vue'

export const usePipelineDebug = () => {
  const pipelineStatus = ref({
    step: 'Initializing',
    complete: 0,
    failed: 0,
    steps: ['Ingest', 'Cleanse', 'Transform', 'Train', 'Deploy']
  })

  const pipelineLogs = ref<string[]>([])

  const simulateStep = (step: string) => {
    pipelineLogs.value.push(`Starting ${step}...`)
    setTimeout(() => {
      pipelineStatus.value.complete++
      pipelineLogs.value.push(`${step} complete.`)
    }, 500)
  }

  const runAll = () => {
    for (const step of pipelineStatus.value.steps) simulateStep(step)
  }

  return {
    pipelineStatus,
    pipelineLogs,
    runAll
  }
}

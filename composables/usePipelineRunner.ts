import { ref } from 'vue'
import { useSupabase } from './supabase'

export const usePipelineRunner = () => {
  const supabase = useSupabase()
  const isRunning = ref(false)
  const currentStep = ref<number>(0)
  const logs = ref<string[]>([])
  const error = ref<string | null>(null)
  const progress = ref<number>(0)

  const addLog = (message: string) => {
    logs.value.push(`[${new Date().toISOString()}] ${message}`)
  }

  const executeStep = async (step: any) => {
    addLog(`Starting step: ${step.name}`)
    step.status = 'running'

    try {
      switch (step.type) {
        case 'input_processor':
          await handleInputProcessing(step)
          break
        case 'llm_processor':
          await handleLLMProcessing(step)
          break
        case 'output_processor':
          await handleOutputProcessing(step)
          break
        default:
          throw new Error(`Unknown step type: ${step.type}`)
      }

      step.status = 'completed'
      addLog(`Completed step: ${step.name}`)
    } catch (err: any) {
      step.status = 'failed'
      step.error = err.message
      addLog(`Failed step: ${step.name} - ${err.message}`)
      throw err
    }
  }

  const handleInputProcessing = async (step: any) => {
    // Implement input processing logic based on step.config
    // const { extract_code_context, identify_language } = step.config
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated delay
    return { processed: true }
  }

  const handleLLMProcessing = async (step: any) => {
    // Implement LLM processing logic based on step.config
    // const { temperature, max_tokens, include_code_blocks, format } = step.config
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated delay
    return { processed: true }
  }

  const handleOutputProcessing = async (step: any) => {
    // Implement output processing logic based on step.config
    // const { highlight_code, add_explanations, format_markdown } = step.config
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated delay
    return { processed: true }
  }

  const runPipeline = async (pipelineId: string) => {
    isRunning.value = true
    error.value = null
    logs.value = []
    currentStep.value = 0
    progress.value = 0

    try {
      // Fetch pipeline configuration
      const { data: pipeline, error: err } = await supabase
        .from('pipelines')
        .select('*')
        .eq('id', pipelineId)
        .single()

      if (err) throw err
      if (!pipeline) throw new Error('Pipeline not found')

      const config = pipeline.config as any
      if (!config.steps?.length) {
        throw new Error('Pipeline has no steps configured')
      }

      // Initialize steps
      config.steps.forEach((step: any) => {
        step.status = 'pending'
      })

      // Execute steps sequentially
      for (let i = 0; i < config.steps.length; i++) {
        currentStep.value = i
        progress.value = (i / config.steps.length) * 100

        await executeStep(config.steps[i])

        // Log step execution
        await supabase.from('pipeline_step_executions').insert({
          step_id: config.steps[i].name,
          status: config.steps[i].status,
          error_message: config.steps[i].error,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      }

      progress.value = 100
      addLog('Pipeline execution completed successfully')
      
      // Update pipeline execution status
      await supabase.from('pipeline_executions').insert({
        pipeline_id: pipelineId,
        status: 'completed',
        logs: logs.value.join('\n'),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        executed_by: (await supabase.auth.getUser()).data.user?.id || ''
      })

      return { success: true, logs: logs.value }
    } catch (err: any) {
      error.value = err.message
      addLog(`Pipeline execution failed: ${err.message}`)
      
      // Log failed execution
      await supabase.from('pipeline_executions').insert({
        pipeline_id: pipelineId,
        status: 'failed',
        error_message: err.message,
        logs: logs.value.join('\n'),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        executed_by: (await supabase.auth.getUser()).data.user?.id || ''
      })

      return { success: false, error: err.message, logs: logs.value }
    } finally {
      isRunning.value = false
    }
  }

  return {
    isRunning,
    currentStep,
    logs,
    error,
    progress,
    runPipeline
  }
}

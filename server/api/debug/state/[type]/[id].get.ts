import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, getQuery } from 'h3'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    const type = query.type as string
    const id = query.id as string

    if (!type || !id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: type, id',
      })
    }

    // Create Supabase client
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing',
      })
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey)

    let stateData: any = null
    let error: any = null

    // Get state based on type
    switch (type) {
      case 'training': {
        const { data: trainingData, error: trainingError } = await supabase
          .from('training_sessions')
          .select('*')
          .eq('id', id)
          .single()
        stateData = trainingData
        error = trainingError
        break
      }

      case 'pipeline': {
        const { data: pipelineData, error: pipelineError } = await supabase
          .from('pipeline_executions')
          .select('*')
          .eq('id', id)
          .single()
        stateData = pipelineData
        error = pipelineError
        break
      }

      case 'deployment': {
        const { data: deploymentData, error: deploymentError } = await supabase
          .from('deployments')
          .select('*')
          .eq('id', id)
          .single()
        stateData = deploymentData
        error = deploymentError
        break
      }

      case 'bot': {
        const { data: botData, error: botError } = await supabase
          .from('bots')
          .select('*')
          .eq('id', id)
          .single()
        stateData = botData
        error = botError
        break
      }

      case 'model': {
        const { data: modelData, error: modelError } = await supabase
          .from('models')
          .select('*')
          .eq('id', id)
          .single()
        stateData = modelData
        error = modelError
        break
      }

      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid type. Must be one of: training, pipeline, deployment, bot, model',
        })
    }

    if (error || !stateData) {
      throw createError({
        statusCode: 404,
        statusMessage: `${type} with id ${id} not found`,
      })
    }

    // Add additional debug information based on type
    let debugInfo: any = {
      id: stateData.id,
      type,
      status: stateData.status,
      created_at: stateData.created_at,
      updated_at: stateData.updated_at,
    }

    switch (type) {
      case 'training':
        debugInfo = {
          ...debugInfo,
          name: stateData.name,
          progress: stateData.progress || 0,
          current_epoch: stateData.current_epoch || 0,
          started_at: stateData.started_at,
          completed_at: stateData.completed_at,
          logs: stateData.logs,
          metrics: stateData.metrics,
        }
        break

      case 'pipeline':
        debugInfo = {
          ...debugInfo,
          pipeline_id: stateData.pipeline_id,
          steps_completed: stateData.steps_completed || 0,
          duration_seconds: stateData.duration_seconds,
          error_message: stateData.error_message,
          results: stateData.results,
          logs: stateData.logs,
        }
        break

      case 'deployment':
        debugInfo = {
          ...debugInfo,
          name: stateData.name,
          endpoint_url: stateData.endpoint_url,
          config: stateData.config,
        }
        break

      case 'bot':
        debugInfo = {
          ...debugInfo,
          name: stateData.name,
          model: stateData.model,
          prompt: stateData.prompt,
          tools: stateData.tools,
          memory: stateData.memory,
        }
        break

      case 'model':
        debugInfo = {
          ...debugInfo,
          name: stateData.name,
        }
        break
    }

    return {
      success: true,
      data: debugInfo,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error while fetching debug state',
    })
  }
})

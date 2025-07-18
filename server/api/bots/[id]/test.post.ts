// API endpoint to test bot responses
import { createClient } from '@supabase/supabase-js'
import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  // Robustly extract botId from params or path
  let botId = event.context?.params?.id
  if (!botId) {
    const pathMatch = event.path.match(/\/api\/bots\/([^/]+)\/test/)
    botId = pathMatch ? pathMatch[1] : undefined
  }
  const message = body?.message
  if (!botId || !message) {
    return { error: 'Missing botId or message' }
  }

  // Create Supabase client
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL as string
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY as string
  const client = createClient(supabaseUrl, supabaseKey)

  // Fetch bot config from DB
  const { data: bot, error } = await client
    .from('bots')
    .select('*')
    .eq('id', botId)
    .single()
  if (error || !bot) {
    return { error: 'Bot not found' }
  }

  // Find pipeline by bot_id
  const { data: pipeline, error: pipeError } = await client
    .from('pipelines')
    .select('*')
    .eq('bot_id', bot.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (pipeError || !pipeline) {
    return { error: 'No pipeline found for this bot.' }
  }

  // Simulate step-by-step pipeline execution
  const steps = Array.isArray(pipeline.config?.steps)
    ? pipeline.config.steps
    : []
  const stepResults = []
  for (let i = 0; i < steps.length; i++) {
    // Simulate each step (replace with real logic)
    stepResults.push({
      name: steps[i].name || steps[i],
      status: i === 0 ? 'running' : 'pending', // Only first step is running for demo
      result:
        i === 0
          ? `Step '${steps[i].name || steps[i]}' started with input: ${message}`
          : null,
    })
  }
  return {
    response: `Bot ${bot.name} (pipeline: ${pipeline.name}) received: ${message}`,
    steps: stepResults,
  }
})

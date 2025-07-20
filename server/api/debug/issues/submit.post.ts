import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, readBody } from 'h3'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async event => {
  try {
    const body = await readBody(event)

    // Validate request body
    const { title, description, severity, category, steps, environment } = body

    if (!title || !description || !severity || !category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: title, description, severity, category',
      })
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(severity)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid severity. Must be one of: low, medium, high, critical',
      })
    }

    // Validate category
    const validCategories = ['bot', 'model', 'pipeline', 'api', 'ui', 'performance', 'other']
    if (!validCategories.includes(category)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category. Must be one of: bot, model, pipeline, api, ui, performance, other',
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

    // Create support request for debug issue
    const supportRequest = {
      name: 'Debug Issue',
      email: 'debug@cloudless.gr',
      plan: null,
      priority: severity === 'critical' ? 'high' : severity === 'high' ? 'medium' : 'low',
      subject: `[${category.toUpperCase()}] ${title}`,
      description: `${description}\n\nSeverity: ${severity}\nCategory: ${category}\nEnvironment: ${environment || 'production'}\n\nSteps to reproduce:\n${steps || 'Not provided'}`,
      attachments: null,
      status: 'open',
      assigned_to: null,
      ip_address: null,
      user_agent: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: requestData, error: requestError } = await supabase
      .from('support_requests')
      .insert([supportRequest])
      .select()
      .single()

    if (requestError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create debug issue',
      })
    }

    // Log the issue for monitoring
    // console.log(`Debug issue created: ${requestData.id} - ${severity} ${category} issue`)

    // In a real implementation, you might:
    // 1. Send notification to development team
    // 2. Create ticket in issue tracking system
    // 3. Trigger automated diagnostics
    // 4. Update monitoring dashboards

    return {
      success: true,
      data: {
        issueId: requestData.id,
        status: 'open',
        message: 'Debug issue submitted successfully',
        estimatedResponseTime: severity === 'critical' ? '1 hour' : severity === 'high' ? '4 hours' : '24 hours',
      },
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during issue submission',
    })
  }
})

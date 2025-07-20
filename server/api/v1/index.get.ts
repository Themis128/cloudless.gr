// API v1 Index - Main entry point for external integrations
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const baseUrl = process.env.NUXT_HOST || 'localhost'
  const port = process.env.NUXT_PORT || '3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const apiBase = `${protocol}://${baseUrl}:${port}/api/v1`

  return {
    api: {
      version: '1.0.0',
      name: 'Cloudless Wizard API',
      description: 'AI-Powered Cloud Solutions API for external integrations',
      baseUrl: apiBase,
      documentation: `${apiBase}/docs`,
      status: 'active',
      timestamp: new Date().toISOString(),
    },
    endpoints: {
      // Authentication & Authorization
      auth: {
        login: {
          method: 'POST',
          url: `${apiBase}/auth/login`,
          description: 'Authenticate user and get access token',
        },
        register: {
          method: 'POST',
          url: `${apiBase}/auth/register`,
          description: 'Register new user account',
        },
        refresh: {
          method: 'POST',
          url: `${apiBase}/auth/refresh`,
          description: 'Refresh access token',
        },
        logout: {
          method: 'POST',
          url: `${apiBase}/auth/logout`,
          description: 'Logout and invalidate token',
        },
      },

      // Bots Management
      bots: {
        list: {
          method: 'GET',
          url: `${apiBase}/bots`,
          description: 'Get all bots for the authenticated user',
        },
        create: {
          method: 'POST',
          url: `${apiBase}/bots`,
          description: 'Create a new bot',
        },
        get: {
          method: 'GET',
          url: `${apiBase}/bots/{id}`,
          description: 'Get specific bot by ID',
        },
        update: {
          method: 'PUT',
          url: `${apiBase}/bots/{id}`,
          description: 'Update bot configuration',
        },
        delete: {
          method: 'DELETE',
          url: `${apiBase}/bots/{id}`,
          description: 'Delete a bot',
        },
        test: {
          method: 'POST',
          url: `${apiBase}/bots/{id}/test`,
          description: 'Test bot with input message',
        },
        deploy: {
          method: 'POST',
          url: `${apiBase}/bots/{id}/deploy`,
          description: 'Deploy bot to production',
        },
        chat: {
          method: 'POST',
          url: `${apiBase}/bots/{id}/chat`,
          description: 'Send message to bot and get response',
        },
      },

      // Models Management
      models: {
        list: {
          method: 'GET',
          url: `${apiBase}/models`,
          description: 'Get all AI models',
        },
        create: {
          method: 'POST',
          url: `${apiBase}/models`,
          description: 'Create a new AI model',
        },
        get: {
          method: 'GET',
          url: `${apiBase}/models/{id}`,
          description: 'Get specific model by ID',
        },
        update: {
          method: 'PUT',
          url: `${apiBase}/models/{id}`,
          description: 'Update model configuration',
        },
        delete: {
          method: 'DELETE',
          url: `${apiBase}/models/{id}`,
          description: 'Delete a model',
        },
        train: {
          method: 'POST',
          url: `${apiBase}/models/{id}/train`,
          description: 'Start model training',
        },
        status: {
          method: 'GET',
          url: `${apiBase}/models/{id}/status`,
          description: 'Get model training status',
        },
        predict: {
          method: 'POST',
          url: `${apiBase}/models/{id}/predict`,
          description: 'Make predictions with trained model',
        },
      },

      // Pipelines Management
      pipelines: {
        list: {
          method: 'GET',
          url: `${apiBase}/pipelines`,
          description: 'Get all data pipelines',
        },
        create: {
          method: 'POST',
          url: `${apiBase}/pipelines`,
          description: 'Create a new data pipeline',
        },
        get: {
          method: 'GET',
          url: `${apiBase}/pipelines/{id}`,
          description: 'Get specific pipeline by ID',
        },
        update: {
          method: 'PUT',
          url: `${apiBase}/pipelines/{id}`,
          description: 'Update pipeline configuration',
        },
        delete: {
          method: 'DELETE',
          url: `${apiBase}/pipelines/{id}`,
          description: 'Delete a pipeline',
        },
        run: {
          method: 'POST',
          url: `${apiBase}/pipelines/{id}/run`,
          description: 'Execute pipeline with input data',
        },
        status: {
          method: 'GET',
          url: `${apiBase}/pipelines/{id}/status`,
          description: 'Get pipeline execution status',
        },
        logs: {
          method: 'GET',
          url: `${apiBase}/pipelines/{id}/logs`,
          description: 'Get pipeline execution logs',
        },
      },

      // Projects Management
      projects: {
        list: {
          method: 'GET',
          url: `${apiBase}/projects`,
          description: 'Get all projects',
        },
        create: {
          method: 'POST',
          url: `${apiBase}/projects`,
          description: 'Create a new project',
        },
        get: {
          method: 'GET',
          url: `${apiBase}/projects/{id}`,
          description: 'Get specific project by ID',
        },
        update: {
          method: 'PUT',
          url: `${apiBase}/projects/{id}`,
          description: 'Update project details',
        },
        delete: {
          method: 'DELETE',
          url: `${apiBase}/projects/{id}`,
          description: 'Delete a project',
        },
        resources: {
          method: 'GET',
          url: `${apiBase}/projects/{id}/resources`,
          description: 'Get project resources (bots, models, pipelines)',
        },
      },

      // Analytics & Monitoring
      analytics: {
        dashboard: {
          method: 'GET',
          url: `${apiBase}/analytics/dashboard`,
          description: 'Get analytics dashboard data',
        },
        metrics: {
          method: 'GET',
          url: `${apiBase}/analytics/metrics`,
          description: 'Get system metrics and performance data',
        },
        usage: {
          method: 'GET',
          url: `${apiBase}/analytics/usage`,
          description: 'Get API usage statistics',
        },
        costs: {
          method: 'GET',
          url: `${apiBase}/analytics/costs`,
          description: 'Get cost analysis and billing information',
        },
      },

      // System & Health
      system: {
        health: {
          method: 'GET',
          url: `${apiBase}/system/health`,
          description: 'Get system health status',
        },
        status: {
          method: 'GET',
          url: `${apiBase}/system/status`,
          description: 'Get detailed system status',
        },
        config: {
          method: 'GET',
          url: `${apiBase}/system/config`,
          description: 'Get system configuration (public)',
        },
      },

      // Webhooks
      webhooks: {
        register: {
          method: 'POST',
          url: `${apiBase}/webhooks/register`,
          description: 'Register webhook endpoint',
        },
        list: {
          method: 'GET',
          url: `${apiBase}/webhooks`,
          description: 'List registered webhooks',
        },
        delete: {
          method: 'DELETE',
          url: `${apiBase}/webhooks/{id}`,
          description: 'Delete webhook registration',
        },
      },
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <your-token>',
      description: 'All API requests require a valid Bearer token in the Authorization header',
    },
    rateLimiting: {
      description: 'API requests are rate limited to ensure fair usage',
      limits: {
        authenticated: '1000 requests per hour',
        unauthenticated: '100 requests per hour',
      },
    },
    errorHandling: {
      format: 'JSON',
      standardErrors: [
        { code: 400, message: 'Bad Request - Invalid input data' },
        { code: 401, message: 'Unauthorized - Invalid or missing token' },
        { code: 403, message: 'Forbidden - Insufficient permissions' },
        { code: 404, message: 'Not Found - Resource not found' },
        { code: 429, message: 'Too Many Requests - Rate limit exceeded' },
        { code: 500, message: 'Internal Server Error - Server error' },
      ],
    },
    examples: {
      curl: {
        auth: `curl -H "Authorization: Bearer YOUR_TOKEN" ${apiBase}/bots`,
        createBot: `curl -X POST ${apiBase}/bots \\
          -H "Authorization: Bearer YOUR_TOKEN" \\
          -H "Content-Type: application/json" \\
          -d '{"name": "My Bot", "type": "customer-support"}'`,
      },
    },
  }
}) 
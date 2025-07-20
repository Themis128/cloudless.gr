// API v1 Documentation - Comprehensive API documentation
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const baseUrl = process.env.NUXT_HOST || 'localhost'
  const port = process.env.NUXT_PORT || '3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const apiBase = `${protocol}://${baseUrl}:${port}/api/v1`

  return {
    openapi: '3.0.0',
    info: {
      title: 'Cloudless Wizard API',
      description: 'AI-Powered Cloud Solutions API for external integrations',
      version: '1.0.0',
      contact: {
        name: 'Cloudless Wizard Support',
        email: 'support@cloudless.wizard',
        url: 'https://cloudless.wizard/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: apiBase,
        description: 'Development server'
      }
    ],
    security: [
      {
        bearerAuth: []
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            }
          }
        },
        Bot: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              example: 'Customer Support Bot'
            },
            type: {
              type: 'string',
              enum: ['customer-support', 'developer-assistant', 'data-analyst', 'content-writer', 'custom']
            },
            description: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'inactive', 'error']
            },
            configuration: {
              type: 'object'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Model: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            type: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['draft', 'training', 'trained', 'error']
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Pipeline: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['draft', 'running', 'completed', 'error']
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    paths: {
      '/auth/login': {
        post: {
          summary: 'Authenticate user',
          description: 'Login with email and password to get access token',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: {
                      type: 'string',
                      format: 'email'
                    },
                    password: {
                      type: 'string',
                      minLength: 8
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          token: {
                            type: 'string'
                          },
                          user: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/bots': {
        get: {
          summary: 'List bots',
          description: 'Get all bots for the authenticated user',
          tags: ['Bots'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                default: 1
              }
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                default: 10
              }
            },
            {
              name: 'status',
              in: 'query',
              description: 'Filter by status',
              schema: {
                type: 'string',
                enum: ['draft', 'active', 'inactive', 'error']
              }
            },
            {
              name: 'type',
              in: 'query',
              description: 'Filter by type',
              schema: {
                type: 'string',
                enum: ['customer-support', 'developer-assistant', 'data-analyst', 'content-writer', 'custom']
              }
            }
          ],
          responses: {
            '200': {
              description: 'List of bots',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          bots: {
                            type: 'array',
                            items: {
                              $ref: '#/components/schemas/Bot'
                            }
                          },
                          pagination: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create bot',
          description: 'Create a new bot',
          tags: ['Bots'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'type'],
                  properties: {
                    name: {
                      type: 'string'
                    },
                    type: {
                      type: 'string',
                      enum: ['customer-support', 'developer-assistant', 'data-analyst', 'content-writer', 'custom']
                    },
                    description: {
                      type: 'string'
                    },
                    configuration: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Bot created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          bot: {
                            $ref: '#/components/schemas/Bot'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/bots/{id}/chat': {
        post: {
          summary: 'Chat with bot',
          description: 'Send a message to a bot and get response',
          tags: ['Bots'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Bot ID',
              schema: {
                type: 'string',
                format: 'uuid'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: {
                      type: 'string'
                    },
                    context: {
                      type: 'object'
                    },
                    sessionId: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Chat response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          response: {
                            type: 'string'
                          },
                          sessionId: {
                            type: 'string'
                          },
                          bot: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/analytics/dashboard': {
        get: {
          summary: 'Get dashboard analytics',
          description: 'Get comprehensive analytics and metrics',
          tags: ['Analytics'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              description: 'Time period for analytics',
              schema: {
                type: 'string',
                enum: ['7d', '30d', '90d', '1y'],
                default: '7d'
              }
            },
            {
              name: 'projectId',
              in: 'query',
              description: 'Filter by project ID',
              schema: {
                type: 'string',
                format: 'uuid'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Analytics data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          metrics: {
                            type: 'object'
                          },
                          usageTrends: {
                            type: 'object'
                          },
                          performance: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/webhooks/register': {
        post: {
          summary: 'Register webhook',
          description: 'Register a webhook endpoint to receive events',
          tags: ['Webhooks'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: {
                      type: 'string',
                      format: 'uri'
                    },
                    events: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: [
                          'bot.created',
                          'bot.updated',
                          'bot.deleted',
                          'bot.deployed',
                          'conversation.created',
                          'model.trained',
                          'pipeline.completed',
                          'project.created',
                          'project.updated'
                        ]
                      }
                    },
                    description: {
                      type: 'string'
                    },
                    secret: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Webhook registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          webhook: {
                            type: 'object'
                          },
                          secret: {
                            type: 'string'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Bots',
        description: 'AI bot management and interactions'
      },
      {
        name: 'Models',
        description: 'AI model management and training'
      },
      {
        name: 'Pipelines',
        description: 'Data pipeline management'
      },
      {
        name: 'Projects',
        description: 'Project management'
      },
      {
        name: 'Analytics',
        description: 'Analytics and metrics'
      },
      {
        name: 'Webhooks',
        description: 'Webhook management for event notifications'
      }
    ]
  }
}) 
const { test, expect } = require('@playwright/test')

test.describe('🔌 API Endpoint Tests', () => {
  const baseURL = 'http://192.168.0.23:3000'

  test('📊 Pipeline API - Create Pipeline', async ({ request }) => {
    const pipelineData = {
      name: 'API Test Pipeline',
      description: 'Pipeline created via API test',
      config: JSON.stringify({
        type: 'Data Processing',
        version: '1.0.0',
        inputType: 'JSON',
        outputType: 'CSV',
        steps: []
      }),
      status: 'draft'
    }

    const response = await request.post(`${baseURL}/api/prisma/pipelines`, {
      data: pipelineData
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('API Test Pipeline')
  })

  test('🧠 Model API - Create Model', async ({ request }) => {
    const modelData = {
      name: 'API Test Model',
      description: 'Model created via API test',
      type: 'Classification',
      config: JSON.stringify({
        framework: 'TensorFlow',
        version: '1.0.0',
        parameters: {}
      }),
      status: 'draft'
    }

    const response = await request.post(`${baseURL}/api/prisma/models`, {
      data: modelData
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('API Test Model')
  })

  test('📁 Project API - Create Project', async ({ request }) => {
    const projectData = {
      project_name: 'API Test Project',
      slug: 'api-test-project-' + Date.now(),
      overview: 'Project created via API test',
      description: 'Test project description',
      isFavorite: false,
      status: 'active',
      category: 'Research',
      featured: false
    }

    const response = await request.post(`${baseURL}/api/prisma/projects`, {
      data: projectData
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.data.project_name).toBe('API Test Project')
  })

  test('📈 Analytics API - Get Dashboard Data', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/analytics/dashboard`)
    
    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result).toHaveProperty('dashboard')
    expect(result).toHaveProperty('success')
    expect(result.success).toBe(true)
  })

  test('🏥 Health Check API', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/health/database`)
    
    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result).toHaveProperty('status')
    expect(result.status).toBe('healthy')
  })

  test('❌ API Error Handling - Invalid Pipeline Data', async ({ request }) => {
    const invalidData = {
      // Missing required fields
      description: 'Invalid pipeline'
    }

    const response = await request.post(`${baseURL}/api/prisma/pipelines`, {
      data: invalidData
    })

    expect(response.status()).toBe(400)
    const result = await response.json()
    expect(result.success).toBe(false)
    expect(result.message).toContain('Missing required fields')
    console.log('Error response:', result)
  })
}) 
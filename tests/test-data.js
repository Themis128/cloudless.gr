// Test data for creation flow tests
const generateUniqueName = (baseName) => {
  const timestamp = Date.now()
  return `${baseName} ${timestamp}`
}

const testData = {
  pipeline: {
    name: 'Test Pipeline',
    description: 'A test pipeline for automated testing',
    type: 'Data Processing',
    version: '1.0.0',
    inputType: 'JSON',
    outputType: 'CSV'
  },
  model: {
    name: 'Test Model',
    type: 'Classification',
    description: 'A test model for automated testing',
    version: '1.0.0',
    framework: 'TensorFlow'
  },
  project: {
    name: 'Test Project',
    description: 'A test project for automated testing',
    type: 'Research',
    version: '1.0.0',
    visibility: 'Public'
  },
  llm: {
    name: 'Test LLM Training',
    baseModel: 'gpt-3.5-turbo',
    trainingType: 'Fine-tuning',
    description: 'A test LLM training job for automated testing'
  }
}

const e2eTestData = {
  pipeline: {
    name: 'E2E Test Pipeline',
    description: 'Pipeline created by E2E test',
    type: 'Data Processing',
    version: '1.0.0',
    inputType: 'JSON',
    outputType: 'CSV'
  },
  model: {
    name: 'E2E Test Model',
    type: 'Classification',
    description: 'Model created by E2E test',
    version: '1.0.0',
    framework: 'TensorFlow'
  },
  project: {
    name: 'E2E Test Project',
    description: 'Project created by E2E test',
    type: 'Research',
    version: '1.0.0',
    visibility: 'Public'
  },
  llm: {
    name: 'E2E Test LLM Training',
    baseModel: 'gpt-3.5-turbo',
    trainingType: 'Fine-tuning',
    description: 'LLM training job created by E2E test'
  }
}

// Helper function to generate unique test data
const generateUniqueTestData = (baseData) => {
  const timestamp = Date.now()
  return {
    ...baseData,
    name: `${baseData.name} ${timestamp}`,
    description: `${baseData.description} (${timestamp})`
  }
}

// Test file data for LLM training
const testFileData = {
  json: {
    name: 'test-training-data.json',
    mimeType: 'application/json',
    content: JSON.stringify({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I\'m doing well, thank you!' }
      ]
    })
  },
  csv: {
    name: 'test-training-data.csv',
    mimeType: 'text/csv',
    content: 'input,output\nHello,Hi there!\nHow are you?,I\'m doing well!'
  },
  txt: {
    name: 'test-training-data.txt',
    mimeType: 'text/plain',
    content: 'This is test training data for E2E testing.'
  }
}

module.exports = {
  testData,
  e2eTestData,
  generateUniqueName,
  generateUniqueTestData,
  testFileData
} 
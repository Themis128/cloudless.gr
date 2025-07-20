<template>
  <div class="api-reference-page">
    <div class="page-header">
      <h1>API Reference</h1>
      <p class="subtitle">
        Complete documentation for the Cloudless Wizard API
      </p>
    </div>

    <div class="content-container">
      <div class="api-content">
        <div class="api-intro">
          <h2>Getting Started</h2>
          <p>
            The Cloudless Wizard API provides programmatic access to all platform features. 
            Use our RESTful API to integrate AI capabilities into your applications, automate 
            workflows, and build custom solutions.
          </p>
          
          <div class="api-info-cards">
            <div class="info-card">
              <div class="info-icon">
                <v-icon size="32" color="primary">
                  mdi-key
                </v-icon>
              </div>
              <h3>Authentication</h3>
              <p>Use API keys for secure access to all endpoints</p>
            </div>
            
            <div class="info-card">
              <div class="info-icon">
                <v-icon size="32" color="success">
                  mdi-json
                </v-icon>
              </div>
              <h3>JSON Format</h3>
              <p>All requests and responses use JSON format</p>
            </div>
            
            <div class="info-card">
              <div class="info-icon">
                <v-icon size="32" color="warning">
                  mdi-clock
                </v-icon>
              </div>
              <h3>Rate Limits</h3>
              <p>1000 requests per minute per API key</p>
            </div>
          </div>
        </div>

        <div class="authentication-section">
          <h2>Authentication</h2>
          <p>
            All API requests require authentication using your API key. Include your API key 
            in the Authorization header of your requests.
          </p>
          
          <div class="code-example">
            <div class="code-header">
              <span>Example Request</span>
              <v-btn size="small" variant="text" @click="copyAuthExample">
                <v-icon size="16">
                  mdi-content-copy
                </v-icon>
              </v-btn>
            </div>
            <pre id="auth-example" class="code-block">curl -X GET "https://api.cloudless.gr/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"</pre>
          </div>
        </div>

        <div class="endpoints-section">
          <h2>API Endpoints</h2>
          
          <div class="endpoint-group">
            <h3>Models</h3>
            <div class="endpoint-list">
              <div class="endpoint-item">
                <div class="endpoint-method get">
                  GET
                </div>
                <div class="endpoint-path">
                  /v1/models
                </div>
                <div class="endpoint-description">
                  List all available models
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method get">
                  GET
                </div>
                <div class="endpoint-path">
                  /v1/models/{id}
                </div>
                <div class="endpoint-description">
                  Get model details
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method post">
                  POST
                </div>
                <div class="endpoint-path">
                  /v1/models
                </div>
                <div class="endpoint-description">
                  Create a new model
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method put">
                  PUT
                </div>
                <div class="endpoint-path">
                  /v1/models/{id}
                </div>
                <div class="endpoint-description">
                  Update model
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method delete">
                  DELETE
                </div>
                <div class="endpoint-path">
                  /v1/models/{id}
                </div>
                <div class="endpoint-description">
                  Delete model
                </div>
              </div>
            </div>
          </div>

          <div class="endpoint-group">
            <h3>Training</h3>
            <div class="endpoint-list">
              <div class="endpoint-item">
                <div class="endpoint-method post">
                  POST
                </div>
                <div class="endpoint-path">
                  /v1/training/sessions
                </div>
                <div class="endpoint-description">
                  Start a training session
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method get">
                  GET
                </div>
                <div class="endpoint-path">
                  /v1/training/sessions/{id}
                </div>
                <div class="endpoint-description">
                  Get training session status
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method post">
                  POST
                </div>
                <div class="endpoint-path">
                  /v1/training/sessions/{id}/cancel
                </div>
                <div class="endpoint-description">
                  Cancel training session
                </div>
              </div>
            </div>
          </div>

          <div class="endpoint-group">
            <h3>Deployment</h3>
            <div class="endpoint-list">
              <div class="endpoint-item">
                <div class="endpoint-method post">
                  POST
                </div>
                <div class="endpoint-path">
                  /v1/deployments
                </div>
                <div class="endpoint-description">
                  Deploy a model
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method get">
                  GET
                </div>
                <div class="endpoint-path">
                  /v1/deployments/{id}
                </div>
                <div class="endpoint-description">
                  Get deployment status
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method delete">
                  DELETE
                </div>
                <div class="endpoint-path">
                  /v1/deployments/{id}
                </div>
                <div class="endpoint-description">
                  Undeploy model
                </div>
              </div>
            </div>
          </div>

          <div class="endpoint-group">
            <h3>Inference</h3>
            <div class="endpoint-list">
              <div class="endpoint-item">
                <div class="endpoint-method post">
                  POST
                </div>
                <div class="endpoint-path">
                  /v1/inference/{deployment_id}
                </div>
                <div class="endpoint-description">
                  Run inference on deployed model
                </div>
              </div>
              
              <div class="endpoint-item">
                <div class="endpoint-method get">
                  GET
                </div>
                <div class="endpoint-path">
                  /v1/inference/{deployment_id}/health
                </div>
                <div class="endpoint-description">
                  Check deployment health
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="examples-section">
          <h2>Code Examples</h2>
          
          <div class="example-tabs">
            <v-tabs v-model="activeTab" color="primary">
              <v-tab value="python">
                Python
              </v-tab>
              <v-tab value="javascript">
                JavaScript
              </v-tab>
              <v-tab value="curl">
                cURL
              </v-tab>
            </v-tabs>
            
            <v-window v-model="activeTab">
              <v-window-item value="python">
                <div class="code-example">
                  <div class="code-header">
                    <span>Python SDK</span>
                    <v-btn size="small" variant="text" @click="copyPythonExample">
                      <v-icon size="16">
                        mdi-content-copy
                      </v-icon>
                    </v-btn>
                  </div>
                  <pre id="python-example" class="code-block">import cloudless

# Initialize client
client = cloudless.Client(api_key="YOUR_API_KEY")

# List models
models = client.models.list()
print(f"Found {len(models)} models")

# Create a new model
model = client.models.create(
    name="my-model",
    type="text-classification",
    description="A custom text classifier"
)

# Start training
session = client.training.start(
    model_id=model.id,
    dataset_id="dataset_123",
    parameters={"epochs": 10}
)

# Deploy model
deployment = client.deployments.create(
    model_id=model.id,
    name="production-deployment"
)

# Run inference
result = client.inference.predict(
    deployment_id=deployment.id,
    data={"text": "Hello, world!"}
)
print(result.predictions)</pre>
                </div>
              </v-window-item>
              
              <v-window-item value="javascript">
                <div class="code-example">
                  <div class="code-header">
                    <span>JavaScript SDK</span>
                    <v-btn size="small" variant="text" @click="copyJavaScriptExample">
                      <v-icon size="16">
                        mdi-content-copy
                      </v-icon>
                    </v-btn>
                  </div>
                  <pre id="javascript-example" class="code-block">const { CloudlessClient } = require('@cloudless/sdk');

// Initialize client
const client = new CloudlessClient({
  apiKey: 'YOUR_API_KEY'
});

// List models
const models = await client.models.list();
console.log(`Found ${models.length} models`);

// Create a new model
const model = await client.models.create({
  name: 'my-model',
  type: 'text-classification',
  description: 'A custom text classifier'
});

// Start training
const session = await client.training.start({
  modelId: model.id,
  datasetId: 'dataset_123',
  parameters: { epochs: 10 }
});

// Deploy model
const deployment = await client.deployments.create({
  modelId: model.id,
  name: 'production-deployment'
});

// Run inference
const result = await client.inference.predict({
  deploymentId: deployment.id,
  data: { text: 'Hello, world!' }
});
console.log(result.predictions);</pre>
                </div>
              </v-window-item>
              
              <v-window-item value="curl">
                <div class="code-example">
                  <div class="code-header">
                    <span>cURL Examples</span>
                    <v-btn size="small" variant="text" @click="copyCurlExample">
                      <v-icon size="16">
                        mdi-content-copy
                      </v-icon>
                    </v-btn>
                  </div>
                  <pre id="curl-example" class="code-block"># List models
curl -X GET "https://api.cloudless.gr/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Create model
curl -X POST "https://api.cloudless.gr/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-model",
    "type": "text-classification",
    "description": "A custom text classifier"
  }'

# Start training
curl -X POST "https://api.cloudless.gr/v1/training/sessions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "model_123",
    "dataset_id": "dataset_456",
    "parameters": {"epochs": 10}
  }'

# Run inference
curl -X POST "https://api.cloudless.gr/v1/inference/deployment_789" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'</pre>
                </div>
              </v-window-item>
            </v-window>
          </div>
        </div>

        <div class="error-codes-section">
          <h2>Error Codes</h2>
          <div class="error-table">
            <div class="error-header">
              <div class="error-code">
                Code
              </div>
              <div class="error-message">
                Message
              </div>
              <div class="error-description">
                Description
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                400
              </div>
              <div class="error-message">
                Bad Request
              </div>
              <div class="error-description">
                Invalid request parameters or malformed JSON
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                401
              </div>
              <div class="error-message">
                Unauthorized
              </div>
              <div class="error-description">
                Invalid or missing API key
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                403
              </div>
              <div class="error-message">
                Forbidden
              </div>
              <div class="error-description">
                Insufficient permissions for the requested resource
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                404
              </div>
              <div class="error-message">
                Not Found
              </div>
              <div class="error-description">
                Requested resource does not exist
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                429
              </div>
              <div class="error-message">
                Too Many Requests
              </div>
              <div class="error-description">
                Rate limit exceeded
              </div>
            </div>
            
            <div class="error-row">
              <div class="error-code">
                500
              </div>
              <div class="error-message">
                Internal Server Error
              </div>
              <div class="error-description">
                Unexpected server error
              </div>
            </div>
          </div>
        </div>

        <div class="sdk-section">
          <h2>SDKs & Libraries</h2>
          <div class="sdk-grid">
            <div class="sdk-card">
              <div class="sdk-icon">
                <v-icon size="48" color="primary">
                  mdi-language-python
                </v-icon>
              </div>
              <h3>Python SDK</h3>
              <p>Official Python client library for Cloudless Wizard API</p>
              <div class="sdk-links">
                <v-btn color="primary" variant="outlined" size="small">
                  Documentation
                </v-btn>
                <v-btn color="primary" variant="outlined" size="small">
                  GitHub
                </v-btn>
              </div>
            </div>
            
            <div class="sdk-card">
              <div class="sdk-icon">
                <v-icon size="48" color="warning">
                  mdi-language-javascript
                </v-icon>
              </div>
              <h3>JavaScript SDK</h3>
              <p>Official JavaScript/Node.js client library</p>
              <div class="sdk-links">
                <v-btn color="warning" variant="outlined" size="small">
                  Documentation
                </v-btn>
                <v-btn color="warning" variant="outlined" size="small">
                  NPM
                </v-btn>
              </div>
            </div>
            
            <div class="sdk-card">
              <div class="sdk-icon">
                <v-icon size="48" color="success">
                  mdi-language-go
                </v-icon>
              </div>
              <h3>Go SDK</h3>
              <p>Official Go client library for high-performance applications</p>
              <div class="sdk-links">
                <v-btn color="success" variant="outlined" size="small">
                  Documentation
                </v-btn>
                <v-btn color="success" variant="outlined" size="small">
                  GitHub
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref('python')

const copyCode = (elementId: string) => {
  const element = document.getElementById(elementId)
  if (element) {
    navigator.clipboard.writeText(element.textContent || '')
  }
}

const copyAuthExample = () => copyCode('auth-example')
const copyPythonExample = () => copyCode('python-example')
const copyJavaScriptExample = () => copyCode('javascript-example')
const copyCurlExample = () => copyCode('curl-example')
</script>

<style scoped>
.api-reference-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.api-content {
  max-width: 1000px;
  margin: 0 auto;
}

.api-intro {
  margin-bottom: 4rem;
}

.api-intro h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.api-intro p {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.api-info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.info-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.info-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.info-icon {
  margin-bottom: 1rem;
}

.info-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.info-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
}

.authentication-section {
  margin-bottom: 4rem;
}

.authentication-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.authentication-section p {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.code-example {
  background: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-weight: 500;
}

.code-block {
  padding: 1.5rem;
  margin: 0;
  color: #e0e0e0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
}

.endpoints-section {
  margin-bottom: 4rem;
}

.endpoints-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
}

.endpoint-group {
  margin-bottom: 3rem;
}

.endpoint-group h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.endpoint-item {
  display: grid;
  grid-template-columns: 80px 1fr 2fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.endpoint-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.endpoint-method {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  text-transform: uppercase;
}

.endpoint-method.get {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.endpoint-method.post {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.endpoint-method.put {
  background: rgba(255, 152, 0, 0.1);
  color: #ff9800;
}

.endpoint-method.delete {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.endpoint-path {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

.endpoint-description {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.examples-section {
  margin-bottom: 4rem;
}

.examples-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
}

.example-tabs {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.error-codes-section {
  margin-bottom: 4rem;
}

.error-codes-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
}

.error-table {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.error-header {
  display: grid;
  grid-template-columns: 100px 1fr 2fr;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(102, 126, 234, 0.1);
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
}

.error-row {
  display: grid;
  grid-template-columns: 100px 1fr 2fr;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.error-row:last-child {
  border-bottom: none;
}

.error-code {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
}

.error-message {
  color: rgba(0, 0, 0, 0.8);
}

.error-description {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.sdk-section {
  margin-bottom: 2rem;
}

.sdk-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
}

.sdk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.sdk-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.sdk-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.sdk-icon {
  margin-bottom: 1rem;
}

.sdk-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.sdk-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.sdk-links {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 768px) {
  .api-reference-page {
    padding: 1rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .api-info-cards {
    grid-template-columns: 1fr;
  }
  
  .endpoint-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .error-header,
  .error-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .sdk-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 
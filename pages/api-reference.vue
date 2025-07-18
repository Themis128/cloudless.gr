<template>
  <div class="api-reference-page">
    <div class="page-header">
      <h1>API Reference</h1>
      <p class="subtitle">
        Complete API documentation for Cloudless.gr platform
      </p>
    </div>

    <div class="content-container">
      <div class="api-content">
        <section class="api-section">
          <h2>🔑 Authentication</h2>
          
          <h3>API Keys</h3>
          <p>All API requests require authentication using your API key. You can find your API key in your account settings.</p>
          
          <div class="code-block">
            <div class="code-header">
              <span>Authentication Header</span>
              <v-btn
                icon
                size="small"
                variant="text"
                data-code="Authorization: Bearer YOUR_API_KEY"
                @click="onCopyCode"
              >
                <v-icon size="16">
                  mdi-content-copy
                </v-icon>
              </v-btn>
            </div>
            <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
          </div>

          <h3>Rate Limits</h3>
          <div class="rate-limits">
            <div class="rate-limit-item">
              <span class="plan">Free Plan</span>
              <span class="limit">1,000 requests/month</span>
            </div>
            <div class="rate-limit-item">
              <span class="plan">Pro Plan</span>
              <span class="limit">100,000 requests/month</span>
            </div>
            <div class="rate-limit-item">
              <span class="plan">Business Plan</span>
              <span class="limit">1,000,000 requests/month</span>
            </div>
            <div class="rate-limit-item">
              <span class="plan">Enterprise</span>
              <span class="limit">Unlimited</span>
            </div>
          </div>
        </section>

        <section class="api-section">
          <h2>🤖 Bot API</h2>
          
          <h3>Create Bot</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/bots</span>
            </div>
            <p>Create a new AI chatbot with the specified configuration.</p>
            
            <h4>Request Body</h4>
            <div class="code-block">
              <div class="code-header">
                <span>JSON</span>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  :data-code="botCreateExample"
                  @click="onCopyCode"
                >
                  <v-icon size="16">
                    mdi-content-copy
                  </v-icon>
                </v-btn>
              </div>
              <pre><code>{{ botCreateExample }}</code></pre>
            </div>

            <h4>Response</h4>
            <div class="code-block">
              <div class="code-header">
                <span>JSON</span>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  :data-code="botCreateResponse"
                  @click="onCopyCode"
                >
                  <v-icon size="16">
                    mdi-content-copy
                  </v-icon>
                </v-btn>
              </div>
              <pre><code>{{ botCreateResponse }}</code></pre>
            </div>
          </div>

          <h3>List Bots</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/bots</span>
            </div>
            <p>Retrieve a list of all bots for the authenticated user.</p>
            
            <h4>Query Parameters</h4>
            <div class="params-table">
              <div class="param-row">
                <span class="param-name">limit</span>
                <span class="param-type">integer</span>
                <span class="param-desc">Number of bots to return (default: 20, max: 100)</span>
              </div>
              <div class="param-row">
                <span class="param-name">offset</span>
                <span class="param-type">integer</span>
                <span class="param-desc">Number of bots to skip (default: 0)</span>
              </div>
              <div class="param-row">
                <span class="param-name">status</span>
                <span class="param-type">string</span>
                <span class="param-desc">Filter by status: active, inactive, training</span>
              </div>
            </div>
          </div>

          <h3>Get Bot</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/bots/{bot_id}</span>
            </div>
            <p>Retrieve detailed information about a specific bot.</p>
          </div>

          <h3>Update Bot</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method put">PUT</span>
              <span class="url">/api/bots/{bot_id}</span>
            </div>
            <p>Update an existing bot's configuration.</p>
          </div>

          <h3>Delete Bot</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method delete">DELETE</span>
              <span class="url">/api/bots/{bot_id}</span>
            </div>
            <p>Permanently delete a bot and all associated data.</p>
          </div>

          <h3>Test Bot</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/bots/{bot_id}/test</span>
            </div>
            <p>Send a test message to a bot and get the response.</p>
            
            <h4>Request Body</h4>
            <div class="code-block">
              <div class="code-header">
                <span>JSON</span>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  :data-code="botTestExample"
                  @click="onCopyCode"
                >
                  <v-icon size="16">
                    mdi-content-copy
                  </v-icon>
                </v-btn>
              </div>
              <pre><code>{{ botTestExample }}</code></pre>
            </div>
          </div>
        </section>

        <section class="api-section">
          <h2>🧠 Model API</h2>
          
          <h3>Create Model</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/models</span>
            </div>
            <p>Create a new AI model with training configuration.</p>
            
            <h4>Request Body</h4>
            <div class="code-block">
              <div class="code-header">
                <span>JSON</span>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  :data-code="modelCreateExample"
                  @click="onCopyCode"
                >
                  <v-icon size="16">
                    mdi-content-copy
                  </v-icon>
                </v-btn>
              </div>
              <pre><code>{{ modelCreateExample }}</code></pre>
            </div>
          </div>

          <h3>List Models</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/models</span>
            </div>
            <p>Retrieve a list of all models for the authenticated user.</p>
          </div>

          <h3>Get Model</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/models/{model_id}</span>
            </div>
            <p>Retrieve detailed information about a specific model.</p>
          </div>

          <h3>Train Model</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/models/{model_id}/train</span>
            </div>
            <p>Start training a model with the provided data.</p>
          </div>

          <h3>Get Training Status</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/models/{model_id}/status</span>
            </div>
            <p>Get the current training status and progress of a model.</p>
          </div>

          <h3>Deploy Model</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/models/{model_id}/deploy</span>
            </div>
            <p>Deploy a trained model for inference.</p>
          </div>
        </section>

        <section class="api-section">
          <h2>🔗 Pipeline API</h2>
          
          <h3>Create Pipeline</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/pipelines</span>
            </div>
            <p>Create a new data processing pipeline.</p>
            
            <h4>Request Body</h4>
            <div class="code-block">
              <div class="code-header">
                <span>JSON</span>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  :data-code="pipelineCreateExample"
                  @click="onCopyCode"
                >
                  <v-icon size="16">
                    mdi-content-copy
                  </v-icon>
                </v-btn>
              </div>
              <pre><code>{{ pipelineCreateExample }}</code></pre>
            </div>
          </div>

          <h3>List Pipelines</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/pipelines</span>
            </div>
            <p>Retrieve a list of all pipelines for the authenticated user.</p>
          </div>

          <h3>Get Pipeline</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/pipelines/{pipeline_id}</span>
            </div>
            <p>Retrieve detailed information about a specific pipeline.</p>
          </div>

          <h3>Run Pipeline</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method post">POST</span>
              <span class="url">/api/pipelines/{pipeline_id}/run</span>
            </div>
            <p>Execute a pipeline with the provided input data.</p>
          </div>

          <h3>Get Pipeline Status</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/pipelines/{pipeline_id}/status</span>
            </div>
            <p>Get the current execution status of a pipeline.</p>
          </div>
        </section>

        <section class="api-section">
          <h2>📊 Analytics API</h2>
          
          <h3>Get Usage Statistics</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/analytics/usage</span>
            </div>
            <p>Retrieve usage statistics for the authenticated user.</p>
            
            <h4>Query Parameters</h4>
            <div class="params-table">
              <div class="param-row">
                <span class="param-name">start_date</span>
                <span class="param-type">string</span>
                <span class="param-desc">Start date in YYYY-MM-DD format</span>
              </div>
              <div class="param-row">
                <span class="param-name">end_date</span>
                <span class="param-type">string</span>
                <span class="param-desc">End date in YYYY-MM-DD format</span>
              </div>
              <div class="param-row">
                <span class="param-name">granularity</span>
                <span class="param-type">string</span>
                <span class="param-desc">Data granularity: day, week, month</span>
              </div>
            </div>
          </div>

          <h3>Get Bot Analytics</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/analytics/bots/{bot_id}</span>
            </div>
            <p>Retrieve analytics data for a specific bot.</p>
          </div>

          <h3>Get Model Analytics</h3>
          <div class="endpoint">
            <div class="endpoint-header">
              <span class="method get">GET</span>
              <span class="url">/api/analytics/models/{model_id}</span>
            </div>
            <p>Retrieve analytics data for a specific model.</p>
          </div>
        </section>

        <section class="api-section">
          <h2>🔧 SDKs & Libraries</h2>
          
          <div class="sdk-grid">
            <div class="sdk-card">
              <v-icon size="48" color="primary">
                mdi-language-javascript
              </v-icon>
              <h3>JavaScript/Node.js</h3>
              <p>Official SDK for JavaScript and Node.js applications</p>
              <div class="sdk-actions">
                <v-btn color="primary" variant="outlined" size="small">
                  Install
                </v-btn>
                <v-btn color="primary" variant="text" size="small">
                  Documentation
                </v-btn>
              </div>
            </div>

            <div class="sdk-card">
              <v-icon size="48" color="primary">
                mdi-language-python
              </v-icon>
              <h3>Python</h3>
              <p>Official SDK for Python applications</p>
              <div class="sdk-actions">
                <v-btn color="primary" variant="outlined" size="small">
                  Install
                </v-btn>
                <v-btn color="primary" variant="text" size="small">
                  Documentation
                </v-btn>
              </div>
            </div>

            <div class="sdk-card">
              <v-icon size="48" color="primary">
                mdi-language-php
              </v-icon>
              <h3>PHP</h3>
              <p>Official SDK for PHP applications</p>
              <div class="sdk-actions">
                <v-btn color="primary" variant="outlined" size="small">
                  Install
                </v-btn>
                <v-btn color="primary" variant="text" size="small">
                  Documentation
                </v-btn>
              </div>
            </div>

            <div class="sdk-card">
              <v-icon size="48" color="primary">
                mdi-language-csharp
              </v-icon>
              <h3>C#/.NET</h3>
              <p>Official SDK for C# and .NET applications</p>
              <div class="sdk-actions">
                <v-btn color="primary" variant="outlined" size="small">
                  Install
                </v-btn>
                <v-btn color="primary" variant="text" size="small">
                  Documentation
                </v-btn>
              </div>
            </div>
          </div>
        </section>

        <section class="api-section">
          <h2>📝 Code Examples</h2>
          
          <h3>JavaScript Example</h3>
          <div class="code-block">
            <div class="code-header">
              <span>JavaScript</span>
              <v-btn
                icon
                size="small"
                variant="text"
                :data-code="jsExample"
                @click="onCopyCode"
              >
                <v-icon size="16">
                  mdi-content-copy
                </v-icon>
              </v-btn>
            </div>
            <pre><code>{{ jsExample }}</code></pre>
          </div>

          <h3>Python Example</h3>
          <div class="code-block">
            <div class="code-header">
              <span>Python</span>
              <v-btn
                icon
                size="small"
                variant="text"
                :data-code="pythonExample"
                @click="onCopyCode"
              >
                <v-icon size="16">
                  mdi-content-copy
                </v-icon>
              </v-btn>
            </div>
            <pre><code>{{ pythonExample }}</code></pre>
          </div>

          <h3>cURL Example</h3>
          <div class="code-block">
            <div class="code-header">
              <span>cURL</span>
              <v-btn
                icon
                size="small"
                variant="text"
                :data-code="curlExample"
                @click="onCopyCode"
              >
                <v-icon size="16">
                  mdi-content-copy
                </v-icon>
              </v-btn>
            </div>
            <pre><code>{{ curlExample }}</code></pre>
          </div>
        </section>

        <section class="api-section">
          <h2>❓ Error Codes</h2>
          
          <div class="error-codes">
            <div class="error-item">
              <span class="error-code">400</span>
              <span class="error-name">Bad Request</span>
              <span class="error-desc">Invalid request parameters or body</span>
            </div>
            <div class="error-item">
              <span class="error-code">401</span>
              <span class="error-name">Unauthorized</span>
              <span class="error-desc">Invalid or missing API key</span>
            </div>
            <div class="error-item">
              <span class="error-code">403</span>
              <span class="error-name">Forbidden</span>
              <span class="error-desc">Insufficient permissions or rate limit exceeded</span>
            </div>
            <div class="error-item">
              <span class="error-code">404</span>
              <span class="error-name">Not Found</span>
              <span class="error-desc">Resource not found</span>
            </div>
            <div class="error-item">
              <span class="error-code">429</span>
              <span class="error-name">Too Many Requests</span>
              <span class="error-desc">Rate limit exceeded</span>
            </div>
            <div class="error-item">
              <span class="error-code">500</span>
              <span class="error-name">Internal Server Error</span>
              <span class="error-desc">Server error, please try again later</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const botCreateExample = ref(`{
  "name": "Customer Support Bot",
  "description": "AI-powered customer support chatbot",
  "model": "gpt-4",
  "prompt": "You are a helpful customer support assistant...",
  "settings": {
    "temperature": 0.7,
    "max_tokens": 1000,
    "response_format": "text"
  },
  "webhook_url": "https://your-app.com/webhook"
}`)

const botCreateResponse = ref(`{
  "id": "bot_123456789",
  "name": "Customer Support Bot",
  "description": "AI-powered customer support chatbot",
  "status": "active",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "webhook_url": "https://your-app.com/webhook",
  "api_endpoint": "https://api.cloudless.gr/bots/bot_123456789"
}`)

const botTestExample = ref(`{
  "message": "Hello, I need help with my order",
  "user_id": "user_123",
  "session_id": "session_456",
  "context": {
    "order_id": "ORD-789",
    "user_type": "customer"
  }
}`)

const modelCreateExample = ref(`{
  "name": "Custom Language Model",
  "description": "Fine-tuned model for customer service",
  "base_model": "gpt-4",
  "training_data": [
    {
      "input": "Customer question text",
      "output": "Expected response text"
    }
  ],
  "hyperparameters": {
    "learning_rate": 0.0001,
    "epochs": 3,
    "batch_size": 16
  }
}`)

const pipelineCreateExample = ref(`{
  "name": "Data Processing Pipeline",
  "description": "Process customer feedback data",
  "steps": [
    {
      "type": "input",
      "name": "data_input",
      "config": {
        "format": "json",
        "source": "webhook"
      }
    },
    {
      "type": "transform",
      "name": "text_cleaning",
      "config": {
        "remove_html": true,
        "lowercase": true
      }
    },
    {
      "type": "ai_model",
      "name": "sentiment_analysis",
      "config": {
        "model_id": "model_123"
      }
    },
    {
      "type": "output",
      "name": "results",
      "config": {
        "format": "json",
        "destination": "database"
      }
    }
  ]
}`)

const jsExample = ref(`// Initialize the Cloudless client
const cloudless = new Cloudless({
  apiKey: 'your_api_key_here'
});

// Create a new bot
const bot = await cloudless.bots.create({
  name: 'Support Bot',
  description: 'Customer support assistant',
  model: 'gpt-4',
  prompt: 'You are a helpful customer support agent...'
});

// Send a message to the bot
const response = await cloudless.bots.test(bot.id, {
  message: 'Hello, I need help',
  user_id: 'user_123'
});

// console.log(response.reply);`)

const pythonExample = ref(`import cloudless

# Initialize the client
client = cloudless.Client(api_key='your_api_key_here')

# Create a new bot
bot = client.bots.create(
    name='Support Bot',
    description='Customer support assistant',
    model='gpt-4',
    prompt='You are a helpful customer support agent...'
)

# Send a message to the bot
response = client.bots.test(
    bot_id=bot.id,
    message='Hello, I need help',
    user_id='user_123'
)

print(response.reply)`)

const curlExample = ref(`# Create a new bot
curl -X POST https://api.cloudless.gr/bots \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Support Bot",
    "description": "Customer support assistant",
    "model": "gpt-4",
    "prompt": "You are a helpful customer support agent..."
  }'

# Test a bot
curl -X POST https://api.cloudless.gr/bots/BOT_ID/test \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, I need help",
    "user_id": "user_123"
  }'`)

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code)
  // You could add a toast notification here
}

const onCopyCode = (event: Event) => {
  const target = event.currentTarget as HTMLElement
  const code = target.getAttribute('data-code')
  if (code) copyCode(code)
}
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

.api-section {
  margin-bottom: 4rem;
}

.api-section:last-child {
  margin-bottom: 0;
}

.api-section h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.api-section h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 2rem 0 1rem 0;
}

.api-section h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 1.5rem 0 0.75rem 0;
}

.api-section p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.7;
  margin-bottom: 1rem;
}

.endpoint {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.method {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.method.get {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.method.post {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.method.put {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.method.delete {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.url {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
}

.code-block {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.1);
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.8);
}

.code-block pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  background: transparent;
}

.code-block code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.8);
}

.rate-limits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.rate-limit-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.plan {
  display: block;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.limit {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.params-table {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
}

.param-row {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.param-row:last-child {
  border-bottom: none;
}

.param-row:first-child {
  background: rgba(102, 126, 234, 0.1);
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
}

.param-name {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
}

.param-type {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.param-desc {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.sdk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
}

.sdk-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.sdk-card h3 {
  margin: 1rem 0 0.5rem 0;
}

.sdk-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.sdk-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.error-codes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.error-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-code {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  min-width: 60px;
  text-align: center;
}

.error-name {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  min-width: 120px;
}

.error-desc {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .api-reference-page {
    padding: 1rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .api-section h2 {
    font-size: 1.5rem;
  }
  
  .api-section h3 {
    font-size: 1.2rem;
  }
  
  .endpoint-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .param-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  
  .error-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .error-name {
    min-width: auto;
  }
}
</style> 
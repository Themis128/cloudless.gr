# LLM Integration Guide

Comprehensive guide for integrating and configuring Large Language Model (LLM) providers with the application for AI-assisted code generation and text processing.

## Overview

The LLM integration system supports multiple providers and models:

- **Local Models**: Ollama (recommended for development)
- **Cloud Providers**: OpenAI GPT, Anthropic Claude, Google Gemini
- **Custom Endpoints**: Any OpenAI-compatible API
- **Fallback Support**: Multiple provider redundancy

## Supported Providers

### 1. Ollama (Local)

**Best for**: Development, privacy, cost control

#### Installation

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download installer from https://ollama.ai/download
```

#### Available Models

```bash
# Code generation (recommended)
ollama pull codellama:34b        # Large, high quality
ollama pull codellama:13b        # Medium, balanced
ollama pull codellama:7b         # Small, fast

# General purpose
ollama pull llama2:70b           # Best quality
ollama pull llama2:13b           # Good balance
ollama pull llama2:7b            # Fastest

# Specialized models
ollama pull mistral:7b           # Good for reasoning
ollama pull wizardcoder:34b      # Code-specific
ollama pull deepseek-coder:33b   # Advanced code generation
```

#### Configuration

```bash
# .env
LLM_API_URL="http://localhost:11434/api/generate"
LLM_MODEL="codellama:34b"
LLM_CONTEXT_LENGTH="4096"
LLM_TEMPERATURE="0.7"
```

#### Starting Ollama

```bash
# Start Ollama server
ollama serve

# Test connection
curl http://localhost:11434/api/version

# Test generation
curl http://localhost:11434/api/generate \
  -d '{"model": "codellama:34b", "prompt": "Write a Hello World in Vue.js", "stream": false}'
```

### 2. OpenAI GPT

**Best for**: Production, highest quality results

#### Setup

```bash
# Install OpenAI SDK (already included)
npm install openai

# Get API key from https://platform.openai.com/api-keys
```

#### Configuration

```bash
# .env
OPENAI_API_KEY="sk-your-openai-api-key-here"
OPENAI_MODEL="gpt-4"              # or gpt-3.5-turbo
OPENAI_MAX_TOKENS="2048"
OPENAI_TEMPERATURE="0.7"
OPENAI_ORGANIZATION="your-org-id"  # Optional
```

#### Available Models

```typescript
const openAIModels = {
  'gpt-4-turbo': {
    contextLength: 128000,
    costPer1kTokens: { input: 0.01, output: 0.03 },
    bestFor: 'Complex reasoning, code generation',
  },
  'gpt-4': {
    contextLength: 8192,
    costPer1kTokens: { input: 0.03, output: 0.06 },
    bestFor: 'Highest quality responses',
  },
  'gpt-3.5-turbo': {
    contextLength: 16384,
    costPer1kTokens: { input: 0.0015, output: 0.002 },
    bestFor: 'Fast, cost-effective generation',
  },
};
```

### 3. Anthropic Claude

**Best for**: Code analysis, reasoning, safety

#### Setup

```bash
# Install Anthropic SDK
npm install @anthropic-ai/sdk

# Get API key from https://console.anthropic.com/
```

#### Configuration

```bash
# .env
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key-here"
ANTHROPIC_MODEL="claude-3-sonnet-20240229"
ANTHROPIC_MAX_TOKENS="2048"
ANTHROPIC_TEMPERATURE="0.7"
```

#### Available Models

```typescript
const claudeModels = {
  'claude-3-opus-20240229': {
    contextLength: 200000,
    costPer1kTokens: { input: 0.015, output: 0.075 },
    bestFor: 'Highest quality, complex reasoning',
  },
  'claude-3-sonnet-20240229': {
    contextLength: 200000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    bestFor: 'Balanced performance and cost',
  },
  'claude-3-haiku-20240307': {
    contextLength: 200000,
    costPer1kTokens: { input: 0.00025, output: 0.00125 },
    bestFor: 'Fast responses, lower cost',
  },
};
```

### 4. Custom Endpoints

Support for any OpenAI-compatible API:

```bash
# .env
CUSTOM_LLM_URL="https://your-custom-llm-api.com/v1/chat/completions"
CUSTOM_LLM_KEY="your-api-key"
CUSTOM_LLM_MODEL="your-model-name"
```

## Integration Architecture

### Core LLM Utility

**Location**: `utils/codeLlama.ts`

```typescript
// LLM Provider abstraction
interface LLMProvider {
  name: string;
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  stream?(prompt: string, onChunk: (chunk: string) => void): Promise<string>;
}

// Main generation function
export async function generateLLMResponse(
  prompt: string,
  onData?: (chunk: string) => void,
  endpoint?: string
): Promise<string> {
  const provider = getProvider(endpoint);

  if (onData && provider.stream) {
    return await provider.stream(prompt, onData);
  } else {
    return await provider.generate(prompt);
  }
}
```

### Provider Implementations

#### Ollama Provider

```typescript
// utils/providers/ollama.ts
export class OllamaProvider implements LLMProvider {
  name = 'ollama';

  async generate(prompt: string, options: LLMOptions = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || process.env.LLM_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_ctx: options.contextLength || 4096,
        },
      }),
    });

    const data = await response.json();
    return data.response;
  }

  async stream(prompt: string, onChunk: (chunk: string) => void) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        prompt,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            onChunk(data.response);
            fullResponse += data.response;
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }

    return fullResponse;
  }
}
```

#### OpenAI Provider

```typescript
// utils/providers/openai.ts
import OpenAI from 'openai';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(prompt: string, options: LLMOptions = {}) {
    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
    });

    return response.choices[0]?.message?.content || '';
  }

  async stream(prompt: string, onChunk: (chunk: string) => void) {
    const stream = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.7,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
        fullResponse += content;
      }
    }

    return fullResponse;
  }
}
```

## Configuration Management

### Provider Selection

```typescript
// utils/llm-config.ts
export function getActiveProvider(): string {
  // Priority order for provider selection
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.LLM_API_URL) return 'ollama';

  throw new Error('No LLM provider configured');
}

export function getProviderConfig(provider: string) {
  switch (provider) {
    case 'openai':
      return {
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048'),
      };

    case 'anthropic':
      return {
        model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
        temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2048'),
      };

    case 'ollama':
      return {
        model: process.env.LLM_MODEL || 'codellama:34b',
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        contextLength: parseInt(process.env.LLM_CONTEXT_LENGTH || '4096'),
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### Environment-Based Configuration

```typescript
// Server API route: server/api/llm.ts
export default defineEventHandler(async (event) => {
  const { prompt, provider, options = {} } = await readBody(event);

  // Use specified provider or auto-detect
  const activeProvider = provider || getActiveProvider();

  // Merge configuration
  const config = {
    ...getProviderConfig(activeProvider),
    ...options,
  };

  try {
    const response = await generateLLMResponse(prompt, null, config);
    return { success: true, response, provider: activeProvider };
  } catch (error) {
    // Try fallback providers
    const fallbackProviders = getFallbackProviders(activeProvider);

    for (const fallback of fallbackProviders) {
      try {
        const response = await generateLLMResponse(prompt, null, fallback);
        return {
          success: true,
          response,
          provider: fallback,
          usedFallback: true,
        };
      } catch (fallbackError) {
        continue;
      }
    }

    throw createError({
      statusCode: 502,
      statusMessage: 'All LLM providers failed',
    });
  }
});
```

## Advanced Features

### 1. Prompt Templates

```typescript
// utils/prompt-templates.ts
export const promptTemplates = {
  codeGeneration: {
    vue: (description: string) =>
      `Create a Vue 3 component with TypeScript for: ${description}.
       Include proper props, emits, and composition API usage.`,

    react: (description: string) =>
      `Create a React functional component with TypeScript for: ${description}.
       Include proper props interface and hooks usage.`,

    api: (description: string) =>
      `Create a REST API endpoint for: ${description}.
       Include proper validation, error handling, and TypeScript types.`,
  },

  codeReview: (code: string) =>
    `Review this code for best practices, performance, and security:

     \`\`\`
     ${code}
     \`\`\`

     Provide specific suggestions for improvement.`,

  debugging: (code: string, error: string) =>
    `Help debug this code that's producing the error: "${error}"

     \`\`\`
     ${code}
     \`\`\`

     Explain the issue and provide a fix.`,
};
```

### 2. Context Management

```typescript
// utils/context-manager.ts
export class LLMContextManager {
  private context: string[] = [];
  private maxContextLength = 4000; // tokens

  addToContext(content: string) {
    this.context.push(content);
    this.trimContext();
  }

  getContextPrompt(newPrompt: string): string {
    const contextStr = this.context.join('\n\n');
    return `Context:\n${contextStr}\n\nNew request: ${newPrompt}`;
  }

  private trimContext() {
    // Estimate tokens (rough approximation)
    const estimatedTokens = this.context.join('').length / 4;

    while (estimatedTokens > this.maxContextLength && this.context.length > 1) {
      this.context.shift(); // Remove oldest context
    }
  }

  clear() {
    this.context = [];
  }
}
```

### 3. Response Caching

```typescript
// utils/llm-cache.ts
import { LRUCache } from 'lru-cache';

const responseCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 30, // 30 minutes
});

export function getCachedResponse(prompt: string): string | undefined {
  return responseCache.get(prompt);
}

export function setCachedResponse(prompt: string, response: string) {
  responseCache.set(prompt, response);
}

export function generateCacheKey(prompt: string, options: LLMOptions): string {
  return `${prompt}:${JSON.stringify(options)}`;
}
```

### 4. Rate Limiting

```typescript
// utils/llm-rate-limiter.ts
interface RateLimit {
  requests: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

export function checkRateLimit(userId: string, maxRequests = 50): boolean {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(userId, {
      requests: 1,
      resetTime: now + hourMs,
    });
    return true;
  }

  if (userLimit.requests < maxRequests) {
    userLimit.requests++;
    return true;
  }

  return false; // Rate limit exceeded
}
```

## Usage Examples

### 1. Basic Code Generation

```vue
<script setup>
import { useLLMAndFileViewer } from '~/composables/useLLMAndFileViewer';

const { sendPrompt, loading, error } = useLLMAndFileViewer();

const generateComponent = async () => {
  const prompt = 'Create a Vue 3 todo list component with add, edit, and delete functionality';

  try {
    const result = await sendPrompt(prompt, (chunk) => {
      // Handle streaming response
      console.log('Received chunk:', chunk);
    });

    console.log('Complete result:', result);
  } catch (err) {
    console.error('Generation failed:', err);
  }
};
</script>
```

### 2. Provider-Specific Usage

```typescript
// Force specific provider
const openAIResult = await generateLLMResponse(prompt, null, {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.3,
});

// Use fallback chain
const result = await generateLLMResponse(prompt, null, {
  providers: ['anthropic', 'openai', 'ollama'],
  temperature: 0.7,
});
```

### 3. Context-Aware Generation

```typescript
const contextManager = new LLMContextManager();

// Add file context
contextManager.addToContext(await loadFile('components/UserCard.vue'));

// Generate with context
const contextualPrompt = contextManager.getContextPrompt(
  'Add TypeScript interfaces for all props in this component'
);

const result = await generateLLMResponse(contextualPrompt);
```

## Error Handling

### Common Error Types

```typescript
export enum LLMError {
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  API_KEY_INVALID = 'API_KEY_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  INVALID_MODEL = 'INVALID_MODEL',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class LLMGenerationError extends Error {
  constructor(
    public code: LLMError,
    message: string,
    public provider?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'LLMGenerationError';
  }
}
```

### Error Recovery

```typescript
export async function generateWithRetry(
  prompt: string,
  maxRetries = 3,
  retryDelay = 1000
): Promise<string> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateLLMResponse(prompt);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof LLMGenerationError) {
        // Don't retry certain errors
        if (error.code === LLMError.API_KEY_INVALID) {
          throw error;
        }

        // Respect rate limit retry-after
        if (error.code === LLMError.RATE_LIMIT_EXCEEDED && error.retryAfter) {
          await new Promise((resolve) => setTimeout(resolve, error.retryAfter * 1000));
          continue;
        }
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  throw lastError!;
}
```

## Performance Optimization

### 1. Streaming Responses

Always use streaming for better user experience:

```typescript
const streamingExample = async () => {
  let accumulatedResponse = '';

  await generateLLMResponse(prompt, (chunk) => {
    accumulatedResponse += chunk;

    // Update UI incrementally
    updateUIWithChunk(chunk);
  });
};
```

### 2. Request Batching

```typescript
export class LLMBatchProcessor {
  private batch: string[] = [];
  private batchSize = 5;
  private processDelay = 1000;

  async addToBatch(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.batch.push({ prompt, resolve, reject });

      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else {
        setTimeout(() => this.processBatch(), this.processDelay);
      }
    });
  }

  private async processBatch() {
    const currentBatch = [...this.batch];
    this.batch = [];

    // Process batch in parallel
    const promises = currentBatch.map(async ({ prompt, resolve, reject }) => {
      try {
        const result = await generateLLMResponse(prompt);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    await Promise.all(promises);
  }
}
```

## Monitoring and Analytics

### Usage Tracking

```typescript
// utils/llm-analytics.ts
export interface LLMUsageMetrics {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  responseTime: number;
  userId?: string;
  success: boolean;
}

export function trackLLMUsage(metrics: LLMUsageMetrics) {
  // Send to analytics service
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/analytics/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...metrics,
        timestamp: Date.now(),
      }),
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused (Ollama)**

   ```bash
   # Check if Ollama is running
   ps aux | grep ollama

   # Start Ollama
   ollama serve

   # Check port availability
   netstat -an | grep 11434
   ```

2. **API Key Invalid (OpenAI/Anthropic)**

   ```bash
   # Test API key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

3. **Rate Limit Exceeded**

   ```typescript
   // Implement exponential backoff
   const backoffDelay = Math.pow(2, attempt) * 1000;
   await new Promise((resolve) => setTimeout(resolve, backoffDelay));
   ```

4. **Context Length Exceeded**
   ```typescript
   // Truncate context
   const maxTokens = 4000;
   const truncatedPrompt = truncateToTokens(prompt, maxTokens);
   ```

### Debug Configuration

```bash
# Enable LLM debug logging
DEBUG=llm:* npm run dev

# Test specific provider
LLM_PROVIDER=ollama npm run dev
```

## Related Documentation

- [Code Generation Feature](codegen-feature.md) - Using LLM for code generation
- [API Reference](api-reference.md) - LLM API endpoints
- [Development Setup](development-setup.md) - Local LLM setup

---

**Last Updated**: December 2024

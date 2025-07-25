# Code Generation Feature Documentation

The Code Generation feature provides AI-assisted development tools to accelerate your coding workflow with intelligent suggestions and automated code creation.

## Overview

The code generation system integrates large language models (LLMs) to provide:

- Real-time code completion and suggestions
- Component generation for multiple frameworks
- Template-based code scaffolding
- Context-aware programming assistance

## Key Components

### 1. CodegenWidget Component

**Location**: `components/CodegenWidget.vue`

The main interactive widget that provides the LLM chat interface:

```vue
<template>
  <div class="codegen-page-wrapper">
    <!-- LLM chat interface -->
    <form @submit.prevent="handleSend">
      <input v-model="prompt" placeholder="Ask the LLM anything..." />
      <button type="submit">Send</button>
    </form>
  </div>
</template>
```

**Features**:

- Real-time streaming responses
- Error handling and loading states
- Customizable prompt interface
- File viewer integration

### 2. Codegen Page

**Location**: `pages/codegen.vue`

The main code generation interface featuring:

- **AI Code Assistant**: Multi-language code completion
- **Component Generator**: Framework-specific component creation
- **Template System**: Pre-built templates for common patterns
- **API Integration Tools**: Generate API endpoints and handlers

## Composable Integration

### useLLMAndFileViewer

**Location**: `composables/useLLMAndFileViewer.ts`

Provides unified access to LLM and file management:

```typescript
import { useLLMAndFileViewer } from '~/composables/useLLMAndFileViewer';

const {
  // LLM functionality
  response,
  loading,
  error,
  sendPrompt,

  // File viewer functionality
  filePath,
  fileContent,
  fileLoading,
  fileError,
  loadFile,
} = useLLMAndFileViewer({
  endpoint: 'custom-llm-endpoint', // Optional custom endpoint
});
```

## Configuration

### Environment Variables

Set up your LLM integration in `.env`:

```bash
# LLM Configuration
LLM_API_URL=http://localhost:11434/api/generate
LLM_MODEL=phind-codellama:34b
LLM_CONTEXT_LENGTH=4096
LLM_TEMPERATURE=0.7

# Optional: Custom endpoints
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Server Configuration

The LLM integration is handled by server API routes:

**Main LLM Route**: `server/api/llm.ts`

```typescript
export default defineEventHandler(async (event) => {
  const { prompt, model, options } = await readBody(event);

  // Process LLM request
  const response = await generateLLMResponse(prompt, options);

  return response;
});
```

**File Generation Route**: `server/api/generate.ts`

- Handles code generation requests
- Supports streaming responses
- Integrates with multiple LLM providers

## Usage Examples

### 1. Basic Code Generation

```typescript
// Ask for component creation
const prompt =
  'Create a Vue 3 component for a user profile card with props for name, email, and avatar';

const result = await sendPrompt(prompt, (data) => {
  // Handle streaming response
  console.log('Received:', data);
});
```

### 2. Framework-Specific Components

Generate components for different frameworks:

```typescript
// Vue.js Component
'Generate a Vue 3 composition API component with TypeScript for a todo list';

// React Component
'Create a React functional component with hooks for user authentication';

// Nuxt Page
'Generate a Nuxt 3 page component with SEO meta tags for a blog post';
```

### 3. API Integration

```typescript
// Generate API endpoints
'Create a REST API endpoint for user registration with validation and error handling';

// Generate composables
'Create a Vue composable for managing shopping cart state with Pinia';
```

### 4. File Loading and Analysis

```typescript
// Load and analyze existing files
await loadFile('components/UserCard.vue');

// Generate improvements
const prompt = `Analyze this Vue component and suggest performance optimizations:\n${fileContent.value}`;
const suggestions = await sendPrompt(prompt);
```

## Advanced Features

### Custom LLM Endpoints

Support for multiple LLM providers:

```typescript
// OpenAI GPT
const openAIOptions = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
};

// Anthropic Claude
const claudeOptions = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-3-sonnet-20240229',
};

// Local Ollama
const localOptions = {
  endpoint: 'http://localhost:11434/api/generate',
  model: 'codellama:34b',
};
```

### Template System

Pre-built templates for common patterns:

```typescript
const templates = {
  'vue-component': 'Generate a Vue 3 component with...',
  'api-endpoint': 'Create a REST API endpoint with...',
  composable: 'Generate a Vue composable for...',
  'pinia-store': 'Create a Pinia store with...',
};
```

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const result = await sendPrompt(prompt);
} catch (error) {
  if (error.code === 'LLM_TIMEOUT') {
    // Handle timeout
  } else if (error.code === 'LLM_QUOTA_EXCEEDED') {
    // Handle quota limits
  } else if (error.code === 'LLM_INVALID_RESPONSE') {
    // Handle malformed responses
  }
}
```

## Performance Optimization

### Streaming Responses

- Real-time response streaming for better UX
- Progressive content loading
- Cancellable requests

### Caching

- Response caching for repeated queries
- Template caching for faster generation
- Context preservation across sessions

### Rate Limiting

- Request throttling to prevent API abuse
- User-specific quotas
- Graceful degradation under load

## Security Considerations

### Input Sanitization

```typescript
// Sanitize user prompts
const sanitizedPrompt = sanitizePrompt(userInput);

// Validate generated code
const isValid = validateGeneratedCode(response);
```

### Content Filtering

- Malicious code detection
- Inappropriate content filtering
- Code injection prevention

## Troubleshooting

### Common Issues

1. **LLM Connection Failed**
   - Check `LLM_API_URL` environment variable
   - Verify LLM service is running
   - Check network connectivity

2. **Slow Response Times**
   - Reduce `LLM_CONTEXT_LENGTH`
   - Use smaller models for faster responses
   - Implement response caching

3. **Generated Code Errors**
   - Add more context to prompts
   - Specify exact framework versions
   - Use example-based prompts

### Debug Mode

Enable debug logging:

```bash
DEBUG=llm:* npm run dev
```

## Integration Examples

### Complete Workflow Example

```typescript
// 1. Initialize the composable
const { sendPrompt, loadFile } = useLLMAndFileViewer();

// 2. Load existing code for context
await loadFile('components/UserCard.vue');

// 3. Generate improved version
const prompt = `Improve this Vue component by adding:
- TypeScript support
- Better accessibility
- Responsive design
- Error handling

Current code:
${fileContent.value}`;

// 4. Get AI suggestions
const improvements = await sendPrompt(prompt);

// 5. Apply suggestions
// (Manual review and implementation)
```

## API Reference

See [API Reference](api-reference.md) for complete endpoint documentation.

## Related Documentation

- [LLM Integration Guide](llm-integration.md) - Detailed LLM setup
- [File Management System](file-management.md) - File operations
- [API Reference](api-reference.md) - Complete API documentation

---

**Last Updated**: December 2024

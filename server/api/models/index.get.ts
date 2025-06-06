import { H3Event } from 'h3';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  capabilities: string[];
}

export default defineEventHandler(async (event: H3Event): Promise<ModelInfo[]> => {
  // Log the models request
  console.log('GET /api/models - Request received at:', new Date().toISOString());
  console.log('Request headers:', getHeaders(event));
  
  // TODO: Implement dynamic model listing from providers
  const models: ModelInfo[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'OpenAI',
      maxTokens: 8192,
      capabilities: ['chat', 'completion', 'function-calling'],
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      maxTokens: 4096,
      capabilities: ['chat', 'completion', 'function-calling'],
    },
    {
      id: 'claude-2',
      name: 'Claude 2',
      provider: 'Anthropic',
      maxTokens: 100000,
      capabilities: ['chat', 'completion', 'function-calling'],
    },
  ];

  return models;
});

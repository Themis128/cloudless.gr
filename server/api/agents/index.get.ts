import { H3Event } from 'h3';
import type { AgentResponse } from './types';

export default defineEventHandler(async (event: H3Event): Promise<AgentResponse[]> => {
  // For future use when implementing database queries
  console.log('GET /api/agents - Request received at:', new Date().toISOString());
  console.log('Request method:', getMethod(event));
  
  // TODO: Implement agent listing from database
  const agents: AgentResponse[] = [
    {
      id: '1',
      name: 'Test Agent',
      description: 'A test agent',
      model: 'gpt-4',
      status: 'active',
      memoryType: 'conversation',
      systemPrompt: 'You are a helpful assistant.',
      config: {
        maxTokens: 2048,
        temperature: 0.7,
        modelRouter: { defaultProvider: 'openai', providers: {} },
        memory: { messageHistory: true },
      },
      workflow: [],
      created: new Date(),
      updated: new Date(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return agents;
});

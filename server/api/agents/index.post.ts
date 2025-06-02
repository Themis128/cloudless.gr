import { H3Event } from 'h3';
import type { AgentResponse, CreateAgentRequest } from './types';

export default defineEventHandler(async (event: H3Event): Promise<AgentResponse> => {
  const body = await readBody<CreateAgentRequest>(event);

  const now = new Date();
  const agent: AgentResponse = {
    id: crypto.randomUUID(),
    name: body.name,
    description: body.description,
    model: body.model,
    status: 'active',
    memoryType: (['vector', 'conversation', 'summary', 'none'] as const).includes(body.memoryType as any)
      ? (body.memoryType as 'vector' | 'conversation' | 'summary' | 'none')
      : 'none',
    systemPrompt: body.systemPrompt,
    config: {
      maxTokens: 2048,
      temperature: 0.7,
      modelRouter: { defaultProvider: 'openai', providers: {} },
      memory: { messageHistory: true },
    },
    workflow: [],
    created: now,
    updated: now,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return agent;
});

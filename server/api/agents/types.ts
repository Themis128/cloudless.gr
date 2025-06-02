import type { Agent } from '~/types/agents';

export interface CreateAgentRequest {
  name: string;
  description: string;
  model: string;
  memoryType: string;
  systemPrompt: string;
  tools: string[];
}

export interface AgentResponse extends Agent {
  createdAt: string;
  updatedAt: string;
}

export interface RunAgentRequest {
  input: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface RunAgentResponse {
  output: string;
  conversationId: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

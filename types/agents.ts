export interface ModelProvider {
  models: string[];
  apiKey?: string;
}

export interface ModelRouter {
  defaultProvider: string;
  providers: {
    [key: string]: ModelProvider;
  };
}

export interface MemoryConfig {
  vectorStore?: {
    enabled: boolean;
    type: 'chroma' | 'qdrant' | 'weaviate';
    endpoint?: string;
  };
  storage?: {
    type: 'minio' | 's3' | 'azure-blob';
    endpoint?: string;
    port?: number;
    useSSL?: boolean;
    accessKey?: string;
    secretKey?: string;
  };
  messageHistory: boolean;
}

export interface AgentConfig {
  maxTokens: number;
  temperature: number;
  modelRouter: ModelRouter;
  memory: MemoryConfig;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  model: string;
  memoryType: 'vector' | 'conversation' | 'summary' | 'none';
  systemPrompt: string;
  config: AgentConfig;
  workflow: WorkflowNode[];
  created: Date;
  updated: Date;
}

export interface WorkflowNode {
  id: string;
  type: 'task' | 'decision' | 'loop' | 'parallel';
  name: string;
  config: Record<string, any>;
  next?: string[];
}

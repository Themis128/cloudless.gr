import { AgentConfigSchema, type AgentConfig } from "../models/agent.model";

export function parseAgentConfig(input: unknown): AgentConfig {
  return AgentConfigSchema.parse(input);
}

export function getDefaultConfig(): AgentConfig {
  return {
    name: "default-agent",
    environment: "development",
    maxConcurrentTasks: 5,
    taskQueueLength: 100,
  };
}

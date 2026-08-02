import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  environment: z.enum(["development", "production"]).default("development"),
  maxConcurrentTasks: z.number().int().min(1).max(100).default(5),
  taskQueueLength: z.number().int().min(1).max(1000).default(100),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export interface Task {
  id: string;
  payload: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface AgentEvent {
  type: string;
  payload: Record<string, unknown>;
}

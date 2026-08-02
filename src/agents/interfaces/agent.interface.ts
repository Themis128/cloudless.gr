import type { AgentConfig, Task, ExecutionResult } from "../models/agent.model";

export interface IAgent {
  readonly config: AgentConfig;

  initialize(): Promise<void>;
  execute(task: Task): Promise<ExecutionResult>;
  shutdown(): Promise<void>;
}

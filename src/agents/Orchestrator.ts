import { EventEmitter } from "events";
import { z } from "zod";
import { createClient, type RedisClientType } from "redis";

const OrchestratorConfigSchema = z.object({
  agentName: z.string(),
  environment: z.enum(["development", "production"]).default("development"),
  taskExpirationTime: z.number().int().default(3600),
});

type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export class Orchestrator extends EventEmitter {
  private readonly config: OrchestratorConfig;
  private client: RedisClientType;

  constructor(config: unknown) {
    super();

    try {
      this.config = OrchestratorConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid orchestrator configuration: ${JSON.stringify(error)}`);
    }

    this.client = createClient({
      url: process.env.REDIS_URL || "redis://ollama-gpu-backend:11434",
    });

    this.client.on("error", (err) => this.emit("orchestrator-connection-error", err));
  }

  // FIX: Merged duplicates into a clean, atomic async connection initializer
  public async initialize(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();

      // Enforce data boundaries on the Redis key namespaces
      await this.client.expire("task_queue", this.config.taskExpirationTime);
    }
  }

  // FIX: Completed the missing code block logic that got truncated by the LLM
  public async delegateTask(taskId: string, payload: Record<string, unknown>): Promise<boolean> {
    await this.initialize();
    try {
      const taskMeta = JSON.stringify({
        targetAgent: this.config.agentName,
        timestamp: Date.now(),
        ...payload,
      });

      // Store payload information under a unique hash reference string mapping pattern
      await this.client.hSet(`task:meta:${taskId}`, "payload", taskMeta);
      await this.client.sAdd("task_queue", taskId);

      this.emit("task-delegated", { taskId, agentName: this.config.agentName });
      return true;
    } catch (error) {
      this.emit("delegation-error", error);
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

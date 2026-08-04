import { EventEmitter } from "node:events";
import { z } from "zod";
import { createClient, type RedisClientType } from "redis";

export const AgentConfigSchema = z.object({
  name: z.string(),
  environment: z.enum(["development", "production"]).default("development"),
  maxConcurrentTasks: z.number().int().default(5),
  taskQueueLength: z.number().int().default(100),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export abstract class BaseAgent extends EventEmitter {
  protected readonly config: AgentConfig;
  protected client: RedisClientType;

  constructor(config: unknown) {
    super();

    try {
      this.config = AgentConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid agent configuration: ${JSON.stringify(error)}`);
    }

    // Explicitly initialize the type-safe Redis client instance mapping hooks
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://ollama-gpu-backend:11434", // Points to our cluster
    });

    this.client.on("error", (err: unknown) => this.emit("connection-error", err));
  }

  public async initialize(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  abstract processTask(taskData: Record<string, unknown>): Promise<void>;

  public async enqueueTask(taskId: string, taskPayload: Record<string, unknown>): Promise<boolean> {
    const validatedPayload = this.validateTaskPayload(taskPayload);
    try {
      // atomic operation set insertions
      await this.client.sAdd("task_queue", taskId);
      await this.client.publish(
        `agent:${this.config.name}:tasks`,
        JSON.stringify({ taskId, ...validatedPayload })
      );
      return true;
    } catch (error) {
      this.emit("task-enqueue-error", error);
      return false;
    }
  }

  protected validateTaskPayload(payload: Record<string, unknown>): Record<string, unknown> {
    return payload;
  }

  public async startProcessing(): Promise<void> {
    await this.initialize();

    // Infinite non-blocking event loop execution
    while (true) {
      try {
        const taskId = await this.client.sPop("task_queue");
        if (!taskId) {
          await new Promise((res) => setTimeout(res, 1000)); // Sleep 1s if empty to protect CPU
          continue;
        }

        // Custom message parser implementation hook
        const message = await this.receiveMessage(taskId);
        await this.processTask(message);
        this.emit("task-processed", { taskId, success: true });
      } catch (error) {
        this.emit("task-error", error);
      }
    }
  }

  protected async getTaskQueueLength(): Promise<number> {
    // FIX: Swapped incorrect setLength lookup for accurate scard Set lookup
    return await this.client.sCard("task_queue");
  }

  protected abstract receiveMessage(taskId: string): Promise<Record<string, unknown>>;

  public async cleanup(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

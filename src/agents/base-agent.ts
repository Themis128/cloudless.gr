import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";

import {
  AgentConfigSchema,
  type AgentConfig,
  type Task,
  type ExecutionResult,
} from "./models/agent.model";
import type { IAgent } from "./interfaces/agent.interface";

export class BaseAgent extends EventEmitter implements IAgent {
  protected readonly config: AgentConfig;
  protected client: RedisClientType;

  constructor(config: unknown) {
    super();

    try {
      this.config = AgentConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid agent configuration: ${JSON.stringify(error)}`);
    }

    this.client = createClient({
      url: process.env.REDIS_URL || "redis://ollama-gpu-backend:11434",
    });

    this.client.on("error", (err: unknown) => this.emit("connection-error", err));
  }

  public async initialize(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public async execute(task: Task): Promise<ExecutionResult> {
    try {
      await this.processTask(task.payload);
      return { success: true, taskId: task.id };
    } catch (error) {
      return {
        success: false,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  abstract processTask(payload: Record<string, unknown>): Promise<void>;

  public async enqueueTask(taskId: string, taskPayload: Record<string, unknown>): Promise<boolean> {
    try {
      await this.client.sAdd("task_queue", taskId);
      await this.client.publish(
        `agent:${this.config.name}:tasks`,
        JSON.stringify({ taskId, ...taskPayload })
      );
      return true;
    } catch (error) {
      this.emit("task-enqueue-error", error);
      return false;
    }
  }

  public async startProcessing(): Promise<void> {
    await this.initialize();

    while (true) {
      try {
        const taskId = await this.client.sPop("task_queue");
        if (!taskId) {
          await new Promise((res) => setTimeout(res, 1000));
          continue;
        }

        const message = await this.receiveMessage(taskId);
        await this.processTask(message);
        this.emit("task-processed", { taskId, success: true });
      } catch (error) {
        this.emit("task-error", error);
      }
    }
  }

  protected async getTaskQueueLength(): Promise<number> {
    return await this.client.sCard("task_queue");
  }

  protected abstract receiveMessage(taskId: string): Promise<Record<string, unknown>>;

  public async shutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

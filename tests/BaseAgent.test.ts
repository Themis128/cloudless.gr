import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseAgent } from "../src/agents/base-agent";
import { AgentConfigSchema } from "../src/agents/models/agent.model";
import { type AgentConfig } from "../src/agents/models/agent.model";

describe("BaseAgent Unit Test Suite", () => {
  let agent: TestAgent;
  let originalRedisClient: any;

  beforeEach(() => {
    const validConfig = {
      name: "test-agent",
      environment: "development",
    };
    agent = new TestAgent(validConfig);

    originalRedisClient = agent["client"];

    const mockRedis = {
      isOpen: true,
      connect: vi.fn().mockResolvedValue(undefined),
      sAdd: vi.fn().mockResolvedValue(1),
      sPop: vi.fn().mockResolvedValue(null),
      publish: vi.fn().mockResolvedValue(0),
      quit: vi.fn().mockResolvedValue(undefined),
    };

    agent["client"] = mockRedis;
  });

  describe("Constructor", () => {
    it("should initialize with valid configuration", () => {
      expect(agent.config.name).toBe("test-agent");
      expect(agent.config.environment).toBe("development");
      expect(agent.config.maxConcurrentTasks).toBe(5);
      expect(agent.config.taskQueueLength).toBe(100);
    });

    it("should throw error with invalid configuration", () => {
      const invalidConfig = { name: "", environment: "invalid" };
      expect(() => new TestAgent(invalidConfig)).toThrow("Invalid agent configuration");
    });
  });

  describe("Task Enqueue (.enqueueTask)", () => {
    it("should enqueue a task successfully", async () => {
      const result = await agent.enqueueTask("task-123", { key: "value" });
      expect(result).toBe(true);
    });
  });

  describe("Event Emission", () => {
    it("should emit task-error events", async () => {
      const spy = vi.fn();
      agent.on("task-error", spy);

      (agent as any).emit("task-error", new Error("Test error"));

      expect(spy).toHaveBeenCalled();
    });
  });

  afterEach(async () => {
    await agent.shutdown();
  });
});

class TestAgent extends BaseAgent {
  async processTask(_payload: Record<string, unknown>): Promise<void> {
    throw new Error("Not implemented");
  }

  async receiveMessage(_taskId: string): Promise<Record<string, unknown>> {
    return {};
  }
}

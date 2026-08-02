import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/agents/Orchestrator";

describe("Orchestrator Unit Test Suite", () => {
  let orchestrator: Orchestrator;
  let mockRedisClient: any;

  beforeEach(() => {
    const validConfig = {
      agentName: "file-explorer-agent",
      environment: "development",
      taskExpirationTime: 3600,
    };

    orchestrator = new Orchestrator(validConfig);

    mockRedisClient = {
      isOpen: true,
      connect: vi.fn().mockResolvedValue(undefined),
      hSet: vi.fn().mockResolvedValue(1),
      sAdd: vi.fn().mockResolvedValue(1),
      sPop: vi.fn().mockResolvedValue(null),
      publish: vi.fn().mockResolvedValue(0),
      quit: vi.fn().mockResolvedValue(undefined),
    };

    (orchestrator as any).client = mockRedisClient;
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe("Constructor", () => {
    it("should initialize with valid configuration", () => {
      expect(orchestrator.config.agentName).toBe("file-explorer-agent");
      expect(orchestrator.config.environment).toBe("development");
      expect(orchestrator.config.taskExpirationTime).toBe(3600);
    });

    it("should throw error with invalid configuration", () => {
      const invalidConfig = { agentName: "", environment: "invalid" };
      expect(() => new Orchestrator(invalidConfig)).toThrow("Invalid orchestrator configuration");
    });
  });

  describe("Task Delegation (.delegateTask)", () => {
    it("should register payload metadata and append queue", async () => {
      const taskId = "orchestration-token-999";
      const taskPayload = { operation: "REFACTOR_IMPORTS" };

      const spyHSet = vi.spyOn(mockRedisClient, "hSet");
      const spySAdd = vi.spyOn(mockRedisClient, "sAdd");

      const status = await orchestrator.delegateTask(taskId, taskPayload);

      expect(status).toBe(true);
      expect(spyHSet).toHaveBeenCalled();
      expect(spySAdd).toHaveBeenCalled();
    });

    it("should emit task-delegated event", async () => {
      const spy = vi.fn();
      orchestrator.on("task-delegated", spy);

      await orchestrator.delegateTask("task-123", {});

      expect(spy).toHaveBeenCalled();
    });
  });
});

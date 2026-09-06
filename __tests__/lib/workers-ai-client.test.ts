import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/admin-ai-usage", () => ({
  recordAdminAiCall: vi.fn().mockResolvedValue(undefined),
}));

import {
  isWorkersAiConfigured,
  isAiGatewayConfigured,
  requireWorkersAiConfig,
  workersAiRunUrl,
  stripThinkingTags,
  parseWorkersAiToolCall,
  buildWorkersAiToolProtocol,
} from "@/lib/workers-ai-client";

afterEach(() => {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_AI_GATEWAY_ID;
});

describe("isWorkersAiConfigured", () => {
  it("returns false when env vars are not set", () => {
    expect(isWorkersAiConfigured()).toBe(false);
  });

  it("returns true when account ID and token are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "token123";
    expect(isWorkersAiConfigured()).toBe(true);
  });
});

describe("isAiGatewayConfigured", () => {
  it("returns false when gateway ID is not set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    expect(isAiGatewayConfigured()).toBe(false);
  });
});

describe("requireWorkersAiConfig", () => {
  it("throws when not configured", () => {
    expect(() => requireWorkersAiConfig()).toThrow("Workers AI not configured");
  });

  it("returns config when env vars are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "wai-token";
    const cfg = requireWorkersAiConfig();
    expect(cfg.accountId).toBe("acct123");
    expect(cfg.apiToken).toBe("wai-token");
  });
});

describe("workersAiRunUrl", () => {
  it("returns direct API URL when gateway is not configured", () => {
    const url = workersAiRunUrl("acct123", "@cf/meta/llama-3.1-8b-instruct");
    expect(url).toContain("api.cloudflare.com");
    expect(url).toContain("acct123");
  });

  it("returns gateway URL when CLOUDFLARE_AI_GATEWAY_ID is set", () => {
    process.env.CLOUDFLARE_AI_GATEWAY_ID = "my-gateway";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    const url = workersAiRunUrl("acct123", "@cf/meta/llama-3.1-8b-instruct");
    expect(url).toContain("gateway.ai.cloudflare.com");
    expect(url).toContain("my-gateway");
  });
});

describe("stripThinkingTags", () => {
  it("removes <thinking>...</thinking> blocks", () => {
    const input = "<thinking>internal thoughts</thinking>Final answer";
    expect(stripThinkingTags(input)).toBe("Final answer");
  });

  it("returns text unchanged when no thinking tags are present", () => {
    expect(stripThinkingTags("Hello world")).toBe("Hello world");
  });
});

describe("parseWorkersAiToolCall", () => {
  it("returns null for non-JSON text", () => {
    expect(parseWorkersAiToolCall("just some text")).toBeNull();
  });

  it("parses a valid tool call JSON", () => {
    const text = JSON.stringify({ tool: "search", args: { query: "test" } });
    const result = parseWorkersAiToolCall(text);
    expect(result?.name).toBe("search");
    expect(result?.args).toEqual({ query: "test" });
  });

  it("strips markdown fences before parsing", () => {
    const text = "```json\n" + JSON.stringify({ tool: "ping", args: {} }) + "\n```";
    const result = parseWorkersAiToolCall(text);
    expect(result?.name).toBe("ping");
  });

  it("returns null for JSON missing the tool field", () => {
    expect(parseWorkersAiToolCall('{"action":"do_something"}')).toBeNull();
  });
});

describe("buildWorkersAiToolProtocol", () => {
  it("returns a non-empty string listing tool names", () => {
    const result = buildWorkersAiToolProtocol([
      { name: "search", description: "Search the web", input_schema: { q: "string" } },
    ]);
    expect(typeof result).toBe("string");
    expect(result).toContain("search");
  });
});

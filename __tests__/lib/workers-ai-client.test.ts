import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/admin-ai-usage", () => ({ recordAdminAiCall: m.record }));

import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  callWorkersAiEmbed,
  embedTextWithWorkersAi,
  isAiGatewayConfigured,
  isEmbeddingsConfigured,
  isWorkersAiConfigured,
  normalizeEmbeddingInput,
  parseWorkersAiToolCall,
  requireWorkersAiConfig,
  stripThinkingTags,
  workersAiRunUrl,
  WORKERS_AI_EMBED_DIMENSIONS,
  WORKERS_AI_EMBED_MODEL,
} from "@/lib/workers-ai-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_WORKERS_AI_TOKEN",
  "CLOUDFLARE_AI_GATEWAY_ID",
  "WORKERS_AI_CHAT_MODEL",
  "WORKERS_AI_EMBED_MODEL",
] as const;

function cfgEnv() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
  process.env.CLOUDFLARE_API_TOKEN = "tok";
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("config gates", () => {
  it("isWorkersAiConfigured / isAiGatewayConfigured / isEmbeddingsConfigured", () => {
    expect(isWorkersAiConfigured()).toBe(false);
    expect(isEmbeddingsConfigured()).toBe(false);
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    expect(isWorkersAiConfigured()).toBe(false);
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "scoped";
    expect(isWorkersAiConfigured()).toBe(true);
    expect(isEmbeddingsConfigured()).toBe(true);
    delete process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(isWorkersAiConfigured()).toBe(true);
    expect(isAiGatewayConfigured()).toBe(false);
    process.env.CLOUDFLARE_AI_GATEWAY_ID = "gw";
    expect(isAiGatewayConfigured()).toBe(true);
  });

  it("requireWorkersAiConfig prefers the scoped token and throws UnauthorizedException", () => {
    expect(() => requireWorkersAiConfig()).toThrowError(
      expect.objectContaining({ name: "UnauthorizedException" })
    );
    cfgEnv();
    expect(requireWorkersAiConfig()).toEqual({ accountId: "acct", apiToken: "tok" });
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN = "scoped";
    expect(requireWorkersAiConfig().apiToken).toBe("scoped");
  });

  it("workersAiRunUrl routes via AI Gateway when configured", () => {
    expect(workersAiRunUrl("acct", "m")).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/m"
    );
    process.env.CLOUDFLARE_AI_GATEWAY_ID = "gw1";
    expect(workersAiRunUrl("acct", "m")).toBe(
      "https://gateway.ai.cloudflare.com/v1/acct/gw1/workers-ai/m"
    );
  });
});

describe("callWorkersAiChat", () => {
  it("returns response text across both result shapes and records the call", async () => {
    cfgEnv();
    mockFetch.mockResolvedValueOnce(json({ result: { response: " hello " } }));
    expect(await callWorkersAiChat([{ role: "user", content: "hi" }])).toBe("hello");
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ ok: true, viaGateway: false }));

    mockFetch.mockResolvedValueOnce(
      json({ result: { response: "  ", choices: [{ message: { content: "choice text" } }] } })
    );
    expect(await callWorkersAiChat([{ role: "user", content: "hi" }])).toBe("choice text");

    mockFetch.mockResolvedValueOnce(json({ result: { choices: [{ text: "legacy" }] } }));
    expect(await callWorkersAiChat([{ role: "user", content: "hi" }])).toBe("legacy");
  });

  it("uses gateway URL + custom model when env set", async () => {
    cfgEnv();
    process.env.CLOUDFLARE_AI_GATEWAY_ID = "gw";
    process.env.WORKERS_AI_CHAT_MODEL = "@cf/custom";
    mockFetch.mockResolvedValueOnce(json({ result: { response: "ok" } }));
    await callWorkersAiChat([{ role: "user", content: "x" }], { maxTokens: 50 });
    expect(String(mockFetch.mock.calls[0][0])).toContain("gateway.ai.cloudflare.com");
    expect(String(mockFetch.mock.calls[0][0])).toContain("@cf/custom");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).max_tokens).toBe(50);
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ viaGateway: true }));
  });

  it("maps 401/403 to UnauthorizedException, other failures to AiError", async () => {
    cfgEnv();
    mockFetch.mockResolvedValueOnce(json({ errors: [{ message: "bad key" }] }, 403));
    await expect(callWorkersAiChat([])).rejects.toMatchObject({
      name: "UnauthorizedException",
      message: "bad key",
    });

    mockFetch.mockResolvedValueOnce(json({}, 500));
    await expect(callWorkersAiChat([])).rejects.toMatchObject({
      name: "AiError",
      message: "Workers AI HTTP 500",
    });
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));

    mockFetch.mockRejectedValueOnce(new Error("socket"));
    await expect(callWorkersAiChat([])).rejects.toThrow("socket");
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: "socket" })
    );
  });

  it("strips thinking tags from replies", () => {
    expect(stripThinkingTags("<thinking>deep</thinking>  Answer ")).toBe("Answer");
    expect(stripThinkingTags("no tags")).toBe("no tags");
  });
});

describe("tool-call protocol", () => {
  it("parseWorkersAiToolCall handles fences, bad JSON, missing tool", () => {
    expect(parseWorkersAiToolCall('{"tool":"book_slot","args":{"a":1}}')).toEqual({
      name: "book_slot",
      args: { a: 1 },
    });
    expect(parseWorkersAiToolCall('```json\n{"tool":"t","args":{"x":2}}\n```')).toEqual({
      name: "t",
      args: { x: 2 },
    });
    expect(parseWorkersAiToolCall('{"tool":"t"}')).toEqual({ name: "t", args: {} });
    expect(parseWorkersAiToolCall("plain reply")).toBeNull();
    expect(parseWorkersAiToolCall('{"tool":5}')).toBeNull();
    expect(parseWorkersAiToolCall('{"tool":"t","args":{')).toBeNull();
  });

  it("buildWorkersAiToolProtocol embeds the catalog", () => {
    const out = buildWorkersAiToolProtocol([
      { name: "book_slot", description: "Book", input_schema: { type: "object" } },
    ]);
    expect(out).toContain("book_slot: Book");
    expect(out).toContain('{"tool":"<name>"');
  });
});

describe("embeddings", () => {
  it("callWorkersAiEmbed returns numeric vector", async () => {
    cfgEnv();
    mockFetch.mockResolvedValueOnce(json({ result: { data: [[0.1, 0.2, 0.3]] } }));
    expect(await callWorkersAiEmbed("text")).toEqual([0.1, 0.2, 0.3]);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ text: ["text"] });
  });

  it("callWorkersAiEmbed errors on HTTP failure and missing data", async () => {
    cfgEnv();
    mockFetch.mockResolvedValueOnce(json({ errors: [{ message: "denied" }] }, 401));
    await expect(callWorkersAiEmbed("t")).rejects.toMatchObject({
      name: "UnauthorizedException",
      message: "denied",
    });
    mockFetch.mockResolvedValueOnce(json({}, 502));
    await expect(callWorkersAiEmbed("t")).rejects.toMatchObject({ name: "AiError" });
    mockFetch.mockResolvedValueOnce(json({ result: { data: [] } }));
    await expect(callWorkersAiEmbed("t")).rejects.toThrow("did not include data[0]");
  });

  it("normalizeEmbeddingInput collapses whitespace + caps at 50k; embedTextWithWorkersAi guards empty", async () => {
    expect(normalizeEmbeddingInput("  a\n\n b\t c  ")).toBe("a b c");
    expect(normalizeEmbeddingInput("x".repeat(60_000))).toHaveLength(50_000);
    await expect(embedTextWithWorkersAi("   ")).rejects.toThrow("Cannot embed empty text");

    cfgEnv();
    mockFetch.mockResolvedValueOnce(json({ result: { data: [[1]] } }));
    expect(await embedTextWithWorkersAi("hi")).toEqual([1]);
  });

  it("exposes embed model + dimensions constants", () => {
    expect(WORKERS_AI_EMBED_MODEL).toContain("@cf/");
    expect(WORKERS_AI_EMBED_DIMENSIONS).toBe(384);
  });
});

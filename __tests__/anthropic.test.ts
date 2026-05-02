import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

import {
  isAnthropicConfigured,
  verifyAnthropicKey,
  callClaude,
} from "@/lib/anthropic";

const CONFIGURED_CONFIG = { ANTHROPIC_API_KEY: "sk-ant-test-key" };
const TEST_API_KEY = "sk-ant-key";
const TEST_API_SECRET = "sk-ant-secret";
const TEST_PROMPT = "prompt";

describe("anthropic.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockGetConfig.mockResolvedValue(CONFIGURED_CONFIG);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── isAnthropicConfigured ────────────────────────────────────────────────────

  describe("isAnthropicConfigured()", () => {
    it("returns true when ANTHROPIC_API_KEY is set", async () => {
      expect(await isAnthropicConfigured()).toBe(true);
    });

    it("returns false when ANTHROPIC_API_KEY is empty", async () => {
      mockGetConfig.mockResolvedValueOnce({ ANTHROPIC_API_KEY: "" });
      expect(await isAnthropicConfigured()).toBe(false);
    });
  });

  // ── verifyAnthropicKey ────────────────────────────────────────────────────────

  describe("verifyAnthropicKey()", () => {
    it("returns not_configured when key is missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ ANTHROPIC_API_KEY: "" });
      expect((await verifyAnthropicKey()).status).toBe("not_configured");
    });

    it("returns valid on 200 response", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "p" }] }), { status: 200 }),
      );
      expect((await verifyAnthropicKey()).status).toBe("valid");
    });

    it("returns rejected on 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );
      const result = await verifyAnthropicKey();
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/401/);
    });

    it("returns error on non-auth HTTP failure", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 500 }),
      );
      expect((await verifyAnthropicKey()).status).toBe("error");
    });

    it("returns error on network failure", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network down"));
      const result = await verifyAnthropicKey();
      expect(result.status).toBe("error");
      expect(result.message).toBe("Connection failed.");
    });
  });

  // ── callClaude ────────────────────────────────────────────────────────────────

  describe("callClaude()", () => {
    it("returns text from the first content block", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ text: "Hello from Claude" }] }),
          { status: 200 },
        ),
      );
      const result = await callClaude("Say hi", TEST_API_KEY);
      expect(result).toBe("Hello from Claude");
    });

    it("sends the correct model and max_tokens", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "ok" }] }), { status: 200 }),
      );
      await callClaude("test", TEST_API_KEY, { model: "claude-haiku-4-5-20251001", maxTokens: 42 });
      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.model).toBe("claude-haiku-4-5-20251001");
      expect(body.max_tokens).toBe(42);
    });

    it("sends the system prompt when provided", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "ok" }] }), { status: 200 }),
      );
      await callClaude(TEST_PROMPT, TEST_API_KEY, { system: "You are a helpful assistant." });
      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.system).toBe("You are a helpful assistant.");
    });

    it("includes the api key header", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "ok" }] }), { status: 200 }),
      );
      await callClaude(TEST_PROMPT, TEST_API_SECRET);
      const headers = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe(TEST_API_SECRET);
    });

    it("throws on non-OK response", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("Bad request", { status: 400 }),
      );
      await expect(callClaude(TEST_PROMPT, TEST_API_KEY)).rejects.toThrow(
        "Anthropic API error 400",
      );
    });

    it("returns empty string when content block is missing", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [] }), { status: 200 }),
      );
      expect(await callClaude(TEST_PROMPT, TEST_API_KEY)).toBe("");
    });
  });
});

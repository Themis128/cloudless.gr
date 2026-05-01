import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

const CONFIGURED_CONFIG = { ANTHROPIC_API_KEY: "sk-ant-test-key" };

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
      const { isAnthropicConfigured } = await import("@/lib/anthropic");
      expect(await isAnthropicConfigured()).toBe(true);
    });

    it("returns false when ANTHROPIC_API_KEY is empty", async () => {
      mockGetConfig.mockResolvedValueOnce({ ANTHROPIC_API_KEY: "" });
      const { isAnthropicConfigured } = await import("@/lib/anthropic");
      expect(await isAnthropicConfigured()).toBe(false);
    });
  });

  // ── verifyAnthropicKey ────────────────────────────────────────────────────────

  describe("verifyAnthropicKey()", () => {
    it("returns not_configured when key is missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ ANTHROPIC_API_KEY: "" });
      const { verifyAnthropicKey } = await import("@/lib/anthropic");
      expect((await verifyAnthropicKey()).status).toBe("not_configured");
    });

    it("returns valid on 200 response", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "p" }] }), { status: 200 }),
      );
      const { verifyAnthropicKey } = await import("@/lib/anthropic");
      expect((await verifyAnthropicKey()).status).toBe("valid");
    });

    it("returns rejected on 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );
      const { verifyAnthropicKey } = await import("@/lib/anthropic");
      const result = await verifyAnthropicKey();
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/401/);
    });

    it("returns error on non-auth HTTP failure", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 500 }),
      );
      const { verifyAnthropicKey } = await import("@/lib/anthropic");
      expect((await verifyAnthropicKey()).status).toBe("error");
    });

    it("returns error on network failure", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network down"));
      const { verifyAnthropicKey } = await import("@/lib/anthropic");
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
      const { callClaude } = await import("@/lib/anthropic");
      const result = await callClaude("Say hi", "sk-ant-key");
      expect(result).toBe("Hello from Claude");
    });

    it("sends the correct model and max_tokens", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "ok" }] }), { status: 200 }),
      );
      const { callClaude } = await import("@/lib/anthropic");
      await callClaude("test", "sk-ant-key", { model: "claude-haiku-4-5-20251001", maxTokens: 42 });
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
      const { callClaude } = await import("@/lib/anthropic");
      await callClaude("prompt", "sk-ant-key", { system: "You are a helpful assistant." });
      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.system).toBe("You are a helpful assistant.");
    });

    it("includes the api key header", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: "ok" }] }), { status: 200 }),
      );
      const { callClaude } = await import("@/lib/anthropic");
      await callClaude("prompt", "sk-ant-secret");
      const headers = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-ant-secret");
    });

    it("throws on non-OK response", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("Bad request", { status: 400 }),
      );
      const { callClaude } = await import("@/lib/anthropic");
      await expect(callClaude("prompt", "sk-ant-key")).rejects.toThrow(
        "Anthropic API error 400",
      );
    });

    it("returns empty string when content block is missing", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [] }), { status: 200 }),
      );
      const { callClaude } = await import("@/lib/anthropic");
      expect(await callClaude("prompt", "sk-ant-key")).toBe("");
    });
  });
});

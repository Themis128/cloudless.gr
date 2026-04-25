import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSlackConfig = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getSlackConfig: () => mockGetSlackConfig(),
  getIntegrations: vi.fn().mockReturnValue({}),
  resetIntegrationCache: vi.fn(),
  resetIntegrationCacheAsync: vi.fn(),
}));

function mockSlackConfig(token = "", webhookUrl = "") {
  mockGetSlackConfig.mockReturnValue({
    SLACK_BOT_TOKEN: token,
    SLACK_SIGNING_SECRET: "",
    SLACK_WEBHOOK_URL: webhookUrl,
  });
}

describe("slack-notify.ts", () => {
  beforeEach(() => {
    // Reset module cache so the module-level `const client = new SlackClient()`
    // is re-executed on next import, picking up the current mock config.
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("SlackClient.post()", () => {
    it("returns false and skips when neither token nor webhook is set", async () => {
      mockSlackConfig();
      const { SlackClient } = await import("@/lib/slack-notify");
      const client = new SlackClient();
      const result = await client.post({ text: "hello" });
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sends via bot API when SLACK_BOT_TOKEN is set", async () => {
      mockSlackConfig("xoxb-test-token");
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      const { SlackClient } = await import("@/lib/slack-notify");
      const client = new SlackClient();
      const result = await client.post({ text: "test message" });
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://slack.com/api/chat.postMessage",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends via webhook when SLACK_WEBHOOK_URL is set (no token)", async () => {
      mockSlackConfig("", "https://hooks.slack.com/services/test");
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("ok", { status: 200 }));
      const { SlackClient } = await import("@/lib/slack-notify");
      const client = new SlackClient();
      const result = await client.post({ text: "webhook message" });
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/services/test",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns false when API returns ok:false with terminal error", async () => {
      mockSlackConfig("xoxb-bad-token");
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), { status: 200 }),
      );
      const { SlackClient } = await import("@/lib/slack-notify");
      const client = new SlackClient();
      const result = await client.post({ text: "fail" });
      expect(result).toBe(false);
    });
  });

  describe("slackNotify()", () => {
    it("returns false when Slack is not configured", async () => {
      mockSlackConfig();
      const { slackNotify } = await import("@/lib/slack-notify");
      const result = await slackNotify({ text: "msg" });
      expect(result).toBe(false);
    });

    it("returns true when send succeeds via webhook", async () => {
      mockSlackConfig("", "https://hooks.slack.com/services/test");
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("ok", { status: 200 }));
      const { slackNotify } = await import("@/lib/slack-notify");
      const result = await slackNotify({ text: "hello" });
      expect(result).toBe(true);
    });
  });

  describe("slackSubscriberNotify()", () => {
    it("calls post with subscriber email in text", async () => {
      mockSlackConfig("", "https://hooks.slack.com/services/test");
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("ok", { status: 200 }));
      const { slackSubscriberNotify } = await import("@/lib/slack-notify");
      await slackSubscriberNotify("user@example.com");
      const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]!.body as string);
      expect(body.text).toContain("user@example.com");
    });
  });

  describe("slackErrorNotify()", () => {
    it("calls post when webhook is configured", async () => {
      mockSlackConfig("", "https://hooks.slack.com/services/test");
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("ok", { status: 200 }));
      const { slackErrorNotify } = await import("@/lib/slack-notify");
      await slackErrorNotify({ title: "Oops", message: "Something broke" });
      expect(global.fetch).toHaveBeenCalledOnce();
    });
  });
});

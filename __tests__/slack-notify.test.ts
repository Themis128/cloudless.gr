import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getSlackConfigAsyncMock } = vi.hoisted(() => ({
  getSlackConfigAsyncMock: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: () => getSlackConfigAsyncMock(),
}));

import {
  SlackClient,
  slackSubscriberNotify,
  slackErrorNotify,
  slackDeployNotify,
  slackContactNotify,
  slackBookingNotify,
  slackOrderNotify,
} from "@/lib/slack-notify";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function jsonResp(data: unknown, headers: Record<string, string> = {}) {
  return {
    ok: true,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null,
    },
    json: async () => data,
  };
}

describe("slack-notify", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getSlackConfigAsyncMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("SlackClient.post — no config", () => {
    it("returns false (silent skip) when neither token nor webhook is configured", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({});
      const client = new SlackClient();
      const ok = await client.post({ text: "hi" });
      expect(ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("SlackClient.post — bot token path", () => {
    it("posts to chat.postMessage and returns true on ok:true", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      const client = new SlackClient({ channel: "#test" });
      const ok = await client.post({ text: "hi" });
      expect(ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("chat.postMessage");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.channel).toBe("#test");
      // Defaults to suppressed unfurl
      expect(body.unfurl_links).toBe(false);
      expect(body.unfurl_media).toBe(false);
    });

    it("falls back to webhook when bot token returns a terminal error", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/fb",
      });
      fetchMock
        .mockResolvedValueOnce(jsonResp({ ok: false, error: "channel_not_found" }))
        .mockResolvedValueOnce({ ok: true });
      const client = new SlackClient();
      const ok = await client.post({ text: "hi" });
      expect(ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toBe("https://hooks.slack.com/services/fb");
    });

    it("returns false when terminal error and no webhook fallback", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(
        jsonResp({ ok: false, error: "invalid_auth" }),
      );
      const client = new SlackClient();
      expect(await client.post({ text: "hi" })).toBe(false);
    });

    it("respects Retry-After on ratelimited and eventually succeeds", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock
        .mockResolvedValueOnce(
          jsonResp(
            { ok: false, error: "ratelimited" },
            { "Retry-After": "2" },
          ),
        )
        .mockResolvedValueOnce(jsonResp({ ok: true }));

      const client = new SlackClient();
      const promise = client.post({ text: "hi" });
      // Advance through the Retry-After delay (2s).
      await vi.advanceTimersByTimeAsync(2_500);
      expect(await promise).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns false after MAX_RETRIES of ratelimited", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValue(
        jsonResp({ ok: false, error: "ratelimited" }, { "Retry-After": "1" }),
      );
      const client = new SlackClient();
      const promise = client.post({ text: "hi" });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await promise).toBe(false);
    });
  });

  describe("SlackClient.post — webhook-only path", () => {
    it("posts to the webhook URL when no bot token is set", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x",
      });
      fetchMock.mockResolvedValueOnce({ ok: true });
      const client = new SlackClient();
      expect(await client.post({ text: "hi" })).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://hooks.slack.com/services/x",
      );
    });

    it("retries the webhook on HTTP error, then gives up", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x",
      });
      fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: "Down" });
      const client = new SlackClient();
      const p = client.post({ text: "hi" });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await p).toBe(false);
      // 3 attempts (MAX_RETRIES), throwing each time then falling into retry catch.
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("slackSubscriberNotify", () => {
    it("posts a header + email block to the subscribers channel", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackSubscriberNotify("alice@example.com");
      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.channel).toBe("#subscribers");
      expect(body.text).toContain("alice@example.com");
      expect(body.username).toBe("Cloudless");
    });
  });

  describe("slackErrorNotify", () => {
    it("posts the first occurrence and dedupes the second within TTL", async () => {
      getSlackConfigAsyncMock.mockResolvedValue({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValue(jsonResp({ ok: true }));

      await slackErrorNotify({
        title: "UniqueDedupTitle-1",
        message: "boom",
        error: new Error("kaboom"),
      });
      const firstCount = fetchMock.mock.calls.length;
      await slackErrorNotify({
        title: "UniqueDedupTitle-1",
        message: "boom",
        error: new Error("kaboom"),
      });
      // Second call was suppressed (no new fetch).
      expect(fetchMock.mock.calls.length).toBe(firstCount);
    });

    it("emits an error to the #errors channel with the title", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackErrorNotify({
        title: "UniqueErrorTitle-2",
        message: "details",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.channel).toBe("#errors");
      expect(body.text).toContain("UniqueErrorTitle-2");
    });
  });

  describe("slackDeployNotify", () => {
    it("uses succeeded label for status=succeeded", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackDeployNotify({
        version: "1.2.3",
        stage: "production",
        status: "succeeded",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.text).toMatch(/Deploy succeeded.*1\.2\.3.*production/);
    });

    it("uses failed label and truncates commitSha to short form", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackDeployNotify({
        version: "1.2.4",
        stage: "production",
        status: "failed",
        commitSha: "abcdef1234567890",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.text).toMatch(/Deploy failed/);
      // Body blocks include the short SHA (first 7 chars)
      const rendered = JSON.stringify(body);
      expect(rendered).toContain("abcdef1");
    });

    it("uses started label when status is started", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackDeployNotify({
        version: "v1",
        stage: "preview",
        status: "started",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.text).toMatch(/Deploy started/);
    });
  });

  describe("slackContactNotify", () => {
    it("posts to #contacts with name and email", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackContactNotify({
        name: "Themis",
        email: "t@x",
        message: "Hello",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.channel).toBe("#contacts");
      const rendered = JSON.stringify(body);
      expect(rendered).toContain("Themis");
      expect(rendered).toContain("t@x");
    });
  });

  describe("slackBookingNotify", () => {
    it("posts a booking message to #bookings", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackBookingNotify({
        name: "Alice",
        email: "alice@x",
        start: "2026-08-12T07:00:00Z",
        notes: "wants serverless review",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.channel).toBe("#bookings");
      expect(JSON.stringify(body)).toContain("alice@x");
    });
  });

  describe("slackOrderNotify", () => {
    it("posts an order message to #orders", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackOrderNotify({
        sessionId: "cs_test_1234567890abcdef",
        amount: "EUR 99.00",
        email: "buyer@x",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.channel).toBe("#orders");
      const rendered = JSON.stringify(body);
      expect(rendered).toContain("EUR 99.00");
      expect(rendered).toContain("buyer@x");
    });

    it("includes attribution line when carrying UTM from Stripe metadata", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({
        SLACK_BOT_TOKEN: "xoxb-x",
      });
      fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }));
      await slackOrderNotify({
        sessionId: "cs_test_with_utm",
        amount: "EUR 890.00",
        email: "founder@example.com",
        attribution:
          "utm_source=linkedin | utm_medium=cpc | utm_campaign=shop_online_founding | utm_content=A_EN | campaign_slug=shop-online | tier=starter",
      });
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      );
      const rendered = JSON.stringify(body);
      // The attribution line surfaces the creative variant so the operator
      // sees ad-creative-level attribution without round-tripping to Stripe.
      expect(rendered).toContain("Attribution:");
      expect(rendered).toContain("utm_content=A_EN");
      expect(rendered).toContain("tier=starter");
    });
  });
});

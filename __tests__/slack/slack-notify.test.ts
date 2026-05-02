import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetSlackConfigCache } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchMock = ReturnType<typeof vi.fn>;

function okFetch(body: object = { ok: true }): FetchMock {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
    }),
  );
}

function webhookOkFetch(): FetchMock {
  return vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
}

function failFetch(err = new Error("Network error")): FetchMock {
  return vi.fn().mockRejectedValue(err);
}

function slackErrorFetch(error: string): FetchMock {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: false, error }), {
      status: 200,
      headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests: SlackClient
// ---------------------------------------------------------------------------

const STATUS_SUCCEEDED = "succeeded";
const ENV_SLACK_BOT_TOKEN = "SLACK_BOT_TOKEN";
const HEADER_CONTENT_TYPE = "content-type";
const CONTENT_TYPE_JSON = "application/json";
const SLACK_HERE_MENTION = "<@here>";
const BOOKING_DATE = "2026-06-10T09:00:00Z";
const ACTOR_THEMIS = "Themis";

describe("SlackClient", () => {
  let SlackClient: (typeof import("@/lib/slack-notify"))["SlackClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    SlackClient = mod.SlackClient;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("when SLACK_BOT_TOKEN is set", () => {
    it("posts to chat.postMessage and returns true on success", async () => {
      const mockFetch = okFetch({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient({ channel: "#test" });
      const result = await client.post({ text: "hello" });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://slack.com/api/chat.postMessage");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body as string);
      expect(body.text).toBe("hello");
      expect(body.channel).toBe("#test");
    });

    it("includes Authorization header with bot token", async () => {
      const mockFetch = okFetch({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      await client.post({ text: "test" });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = opts.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer xoxb-test-token");
    });

    it("sends blocks when provided", async () => {
      const mockFetch = okFetch({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient({ channel: "#alerts" });
      const blocks = [{ type: "section", text: { type: "mrkdwn", text: "test" } }];
      await client.post({ text: "fallback", blocks });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string);
      expect(body.blocks).toEqual(blocks);
    });

    it("returns false after 3 failed attempts", async () => {
      vi.useFakeTimers();
      const mockFetch = failFetch();
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const postPromise = client.post({ text: "test" });
      await vi.runAllTimersAsync();
      const result = await postPromise;

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it("succeeds on second attempt after initial failure", async () => {
      vi.useFakeTimers();
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
          }),
        );
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const postPromise = client.post({ text: "test" });
      await vi.runAllTimersAsync();
      const result = await postPromise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("does not retry on non-ratelimited Slack API errors", async () => {
      const mockFetch = slackErrorFetch("channel_not_found");
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const result = await client.post({ text: "test" });

      // channel_not_found is a terminal error — postViaApi returns null,
      // which the post() wrapper converts to false without retrying
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  describe("when only SLACK_WEBHOOK_URL is set", () => {
    beforeEach(() => {
      vi.stubEnv(ENV_SLACK_BOT_TOKEN, "");
      vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/test");
      resetSlackConfigCache();
    });

    it("posts to webhook URL and returns true on success", async () => {
      const mockFetch = webhookOkFetch();
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const result = await client.post({ text: "webhook message" });

      expect(result).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://hooks.slack.com/services/T/B/test");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body as string);
      expect(body.text).toBe("webhook message");
    });

    it("retries webhook on failure", async () => {
      vi.useFakeTimers();
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("error", { status: 500 }))
        .mockResolvedValue(new Response("ok", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const postPromise = client.post({ text: "test" });
      await vi.runAllTimersAsync();
      const result = await postPromise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe("when neither token nor webhook is configured", () => {
    beforeEach(() => {
      vi.stubEnv(ENV_SLACK_BOT_TOKEN, "");
      resetSlackConfigCache();
    });

    it("returns false immediately without calling fetch", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const client = new SlackClient();
      const result = await client.post({ text: "test" });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: high-level notifier functions
// ---------------------------------------------------------------------------

describe("slackSubscriberNotify", () => {
  let slackSubscriberNotify: (typeof import("@/lib/slack-notify"))["slackSubscriberNotify"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    slackSubscriberNotify = mod.slackSubscriberNotify;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a Block Kit message containing the subscriber email", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackSubscriberNotify("test@example.com");

    expect(mockFetch).toHaveBeenCalled();
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.text).toContain("test@example.com");
    expect(body.blocks).toBeDefined();
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it("includes a header block with subscriber title", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackSubscriberNotify("user@test.com");

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const headerBlock = body.blocks.find((b: { type: string }) => b.type === "header");
    expect(headerBlock).toBeDefined();
    expect(headerBlock.text.text).toContain("Subscriber");
  });

  it("does not throw when Slack is not configured", async () => {
    vi.stubEnv(ENV_SLACK_BOT_TOKEN, "");
    resetSlackConfigCache();
    vi.stubGlobal("fetch", vi.fn());

    await expect(slackSubscriberNotify("no-slack@example.com")).resolves.not.toThrow();
  });

  it("escapes mrkdwn special chars in email", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackSubscriberNotify("<@here>@evil.com");

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(SLACK_HERE_MENTION);
    expect(bodyStr).toContain("&lt;@here&gt;");
  });
});

describe("slackContactNotify", () => {
  let slackContactNotify: (typeof import("@/lib/slack-notify"))["slackContactNotify"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    slackContactNotify = mod.slackContactNotify;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("escapes mrkdwn special chars in name and email", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackContactNotify({
      name: "<@channel>",
      email: "a&b@example.com",
      message: "hello <world>",
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("<@channel>");
    expect(bodyStr).toContain("&lt;@channel&gt;");
    expect(bodyStr).toContain("a&amp;b@example.com");
    expect(bodyStr).toContain("hello &lt;world&gt;");
  });

  it("sends notification with all fields", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const result = await slackContactNotify({
      name: ACTOR_THEMIS,
      email: "themis@cloudless.gr",
      company: "Cloudless",
      service: "AI consulting",
      message: "I need help.",
    });

    expect(result).toBe(true);
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.text).toContain(ACTOR_THEMIS);
    expect(body.text).toContain("themis@cloudless.gr");
  });
});

describe("slackBookingNotify", () => {
  let slackBookingNotify: (typeof import("@/lib/slack-notify"))["slackBookingNotify"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    slackBookingNotify = mod.slackBookingNotify;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes name and email in the notification", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackBookingNotify({
      name: "Alice",
      email: "alice@example.com",
      start: BOOKING_DATE,
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("Alice");
    expect(bodyStr).toContain("alice@example.com");
    expect(body.icon_emoji).toBe(":calendar:");
  });

  it("includes notes when provided", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackBookingNotify({
      name: "Bob",
      email: "bob@example.com",
      start: BOOKING_DATE,
      notes: "Looking forward to the call",
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("Looking forward to the call");
  });

  it("escapes mrkdwn injection in name and email", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackBookingNotify({
      name: SLACK_HERE_MENTION,
      email: "evil&one@example.com",
      start: BOOKING_DATE,
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const bodyStr = JSON.stringify(JSON.parse(opts.body as string));
    expect(bodyStr).not.toContain(SLACK_HERE_MENTION);
    expect(bodyStr).toContain("&lt;@here&gt;");
    expect(bodyStr).toContain("evil&amp;one@example.com");
  });
});

describe("slackErrorNotify", () => {
  let slackErrorNotify: (typeof import("@/lib/slack-notify"))["slackErrorNotify"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    slackErrorNotify = mod.slackErrorNotify;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes error name and message for Error instances", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackErrorNotify({
      title: "Database failure",
      message: "Could not connect",
      error: new TypeError("Connection refused"),
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("TypeError");
    expect(bodyStr).toContain("Connection refused");
  });

  it("includes route when provided", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackErrorNotify({
      title: "API Error",
      message: "Unexpected failure",
      route: "/api/checkout",
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("/api/checkout");
  });

  it("handles non-Error error values (strings, objects)", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      slackErrorNotify({ title: "Oops", message: "Something broke", error: "raw string error" }),
    ).resolves.not.toThrow();
  });
});

describe("slackDeployNotify", () => {
  let slackDeployNotify: (typeof import("@/lib/slack-notify"))["slackDeployNotify"];

  beforeEach(async () => {
    vi.clearAllMocks();
    resetSlackConfigCache();
    const mod = await import("@/lib/slack-notify");
    slackDeployNotify = mod.slackDeployNotify;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["started", ":rocket:"],
    [STATUS_SUCCEEDED, ":white_check_mark:"],
    ["failed", ":x:"],
  ] as const)("uses correct emoji for status=%s", async (status, expectedEmoji) => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackDeployNotify({ version: "1.0.0", stage: "production", status });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.icon_emoji).toBe(expectedEmoji);
  });

  it("truncates commitSha to 7 characters", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackDeployNotify({
      version: "2.0.0",
      stage: "staging",
      status: STATUS_SUCCEEDED,
      commitSha: "abcdef1234567890",
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("abcdef1");
    expect(bodyStr).not.toContain("abcdef1234567890");
  });

  it("omits actor line when actor is not provided", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackDeployNotify({ version: "1.0.0", stage: "production", status: "started" });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("Actor");
  });

  it("includes actor when provided", async () => {
    const mockFetch = okFetch({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await slackDeployNotify({
      version: "1.0.0",
      stage: "production",
      status: STATUS_SUCCEEDED,
      actor: ACTOR_THEMIS,
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain(ACTOR_THEMIS);
  });
});

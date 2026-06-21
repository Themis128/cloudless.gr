import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockGetSlackConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockGetSlackConfig: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

// SlackClient resolves its token via getSlackConfigAsync; stub that so we can
// drive "no token → silent no-op" vs "token → would post" branches.
vi.mock("@/lib/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations")>("@/lib/integrations");
  return { ...actual, getSlackConfigAsync: mockGetSlackConfig };
});

import { notifyPostErrored, notifyPostPublished, notifyOauthExpiry } from "@/lib/postiz-slack";
import type { PostizPost, PostizIntegration } from "@/lib/postiz";

const POST: PostizPost = {
  id: "p1",
  content: "Hello world",
  publishDate: "2026-06-16T10:00:00.000Z",
  state: "PUBLISHED",
  integration: { id: "fb", name: "FB Page", identifier: "facebook" },
  releaseURL: "https://facebook.com/post/1",
  releaseId: "1",
};

const INTEGRATION: PostizIntegration = {
  id: "li",
  name: "LinkedIn Page",
  identifier: "linkedin-page",
  disabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("postiz-slack notifiers (no Slack token)", () => {
  beforeEach(() => {
    mockGetConfig.mockResolvedValue({ POSTIZ_SLACK_CHANNEL: "" });
    mockGetSlackConfig.mockResolvedValue({
      SLACK_BOT_TOKEN: "",
      SLACK_WEBHOOK_URL: "",
      SLACK_DEFAULT_CHANNEL: "",
    });
  });

  it("notifyPostPublished resolves silently when Slack isn't configured", async () => {
    await expect(notifyPostPublished(POST)).resolves.toBeUndefined();
  });

  it("notifyPostErrored resolves silently when Slack isn't configured", async () => {
    await expect(notifyPostErrored(POST, "rate limited")).resolves.toBeUndefined();
  });

  it("notifyOauthExpiry resolves silently when Slack isn't configured", async () => {
    await expect(notifyOauthExpiry(INTEGRATION)).resolves.toBeUndefined();
  });
});

describe("postiz-slack notifiers (with token)", () => {
  beforeEach(() => {
    mockGetConfig.mockResolvedValue({ POSTIZ_SLACK_CHANNEL: "#postiz" });
    mockGetSlackConfig.mockResolvedValue({
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_WEBHOOK_URL: "",
      SLACK_DEFAULT_CHANNEL: "#general",
    });
  });

  it("notifyPostPublished issues a chat.postMessage with the channel override", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await notifyPostPublished(POST);
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes("chat.postMessage"));
    expect(call).toBeDefined();
    if (!call) return;
    const [, init] = call;
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.channel).toBe("#postiz");
    expect(body.username).toBe("Postiz");
    fetchSpy.mockRestore();
  });
});

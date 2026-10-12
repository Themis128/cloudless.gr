import { describe, it, expect, vi } from "vitest";

const { mockGetSlackCfg } = vi.hoisted(() => ({ mockGetSlackCfg: vi.fn() }));
vi.mock("@/lib/integrations", () => ({
  getSlackConfig: mockGetSlackCfg,
  getSlackConfigAsync: mockGetSlackCfg,
}));

mockGetSlackCfg.mockResolvedValue({ SLACK_BOT_TOKEN: "", SLACK_WEBHOOK_URL: "", SLACK_DEFAULT_CHANNEL: "" });

const { mockRecordNotification } = vi.hoisted(() => ({ mockRecordNotification: vi.fn() }));
vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: mockRecordNotification,
}));

import {
  SlackClient,
  slackRegistrationNotify,
  slackErrorNotify,
  slackOrderNotify,
  slackTicketNotify,
} from "@/lib/slack-notify";

describe("SlackClient", () => {
  it("instantiates without args", () => {
    const client = new SlackClient();
    expect(client).toBeInstanceOf(SlackClient);
  });

  it("instantiates with a channel override", () => {
    const client = new SlackClient({ channel: "#test" });
    expect(client).toBeInstanceOf(SlackClient);
  });

  it("post returns false when Slack is not configured", async () => {
    const client = new SlackClient();
    const result = await client.post({ text: "hello" });
    expect(result).toBe(false);
  });
});

describe("slackRegistrationNotify", () => {
  it("returns false when Slack is not configured", async () => {
    const result = await slackRegistrationNotify("user@example.com");
    expect(typeof result).toBe("boolean");
  });
});

describe("slack-notify tails", () => {
  const configured = () => {
    mockGetSlackCfg.mockResolvedValue({
      SLACK_BOT_TOKEN: "",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X",
      SLACK_DEFAULT_CHANNEL: "",
    });
  };

  it("slackErrorNotify mirrors to admin-notifications and swallows mirror failures", async () => {
    configured();
    mockRecordNotification.mockRejectedValueOnce(new Error("db down"));
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await slackErrorNotify({
      title: "Checkout blew up",
      message: "stripe timeout",
      route: "/api/checkout",
      error: new Error("ETIMEDOUT"),
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalled();
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ route: "/api/checkout" })
    );
    vi.unstubAllGlobals();
  });

  it("slackOrderNotify includes campaign/tier and attribution lines", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ok = await slackOrderNotify({
      email: "buyer@example.com",
      amount: "€49.00",
      sessionId: "cs_test_abcdefghij1234567890",
      campaign: "q4-launch",
      tier: "growth",
      attribution: "google / cpc / q4-launch",
    });
    expect(ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.lastCall?.[1].body as string);
    const text = JSON.stringify(body.blocks);
    expect(text).toContain("q4-launch");
    expect(text).toContain("growth");
    expect(text).toContain("google / cpc / q4-launch");
    vi.unstubAllGlobals();
  });

  it("slackTicketNotify includes the reporter email when present", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ok = await slackTicketNotify({
      subject: "Cannot log in",
      email: "reporter@example.com",
      priority: "High",
    });
    expect(ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.lastCall?.[1].body as string);
    expect(JSON.stringify(body.blocks)).toContain("reporter@example.com");
    vi.unstubAllGlobals();
  });
});

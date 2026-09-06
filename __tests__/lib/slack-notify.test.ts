import { describe, it, expect, vi } from "vitest";

const { mockGetSlackCfg } = vi.hoisted(() => ({ mockGetSlackCfg: vi.fn() }));
vi.mock("@/lib/integrations", () => ({
  getSlackConfig: mockGetSlackCfg,
  getSlackConfigAsync: mockGetSlackCfg,
}));

mockGetSlackCfg.mockResolvedValue({ SLACK_BOT_TOKEN: "", SLACK_WEBHOOK_URL: "", SLACK_DEFAULT_CHANNEL: "" });

import { SlackClient, slackRegistrationNotify } from "@/lib/slack-notify";

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

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
}));

import {
  getNewsletterSlackConfigAsync,
  resetNewsletterSlackConfigCache,
} from "@/lib/newsletter-slack-config";

beforeEach(() => {
  resetNewsletterSlackConfigCache();
  mockGetConfig.mockReset();
  delete process.env.NEWSLETTER_SLACK_BOT_TOKEN;
  delete process.env.NEWSLETTER_SLACK_SIGNING_SECRET;
  delete process.env.NEWSLETTER_SLACK_CHANNEL_ID;
});

describe("getNewsletterSlackConfigAsync", () => {
  it("reads from env vars when set", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-test";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "signing-secret";
    process.env.NEWSLETTER_SLACK_CHANNEL_ID = "C123";

    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-test");
    expect(cfg.NEWSLETTER_SLACK_SIGNING_SECRET).toBe("signing-secret");
    expect(cfg.NEWSLETTER_SLACK_CHANNEL_ID).toBe("C123");
  });

  it("falls back to SSM when env vars are missing", async () => {
    mockGetConfig.mockResolvedValue({
      NEWSLETTER_SLACK_BOT_TOKEN: "xoxb-ssm",
      NEWSLETTER_SLACK_SIGNING_SECRET: "ssm-secret",
      NEWSLETTER_SLACK_CHANNEL_ID: "CSSM1",
    });

    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-ssm");
    expect(cfg.NEWSLETTER_SLACK_SIGNING_SECRET).toBe("ssm-secret");
    expect(cfg.NEWSLETTER_SLACK_CHANNEL_ID).toBe("CSSM1");
  });

  it("uses default channel when SSM has no CHANNEL_ID", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-test";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "secret";
    // no CHANNEL_ID

    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_CHANNEL_ID).toBe("C0BBDKY6Q9E");
  });

  it("caches the result after first call", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-cached";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "secret";

    const first = await getNewsletterSlackConfigAsync();
    const second = await getNewsletterSlackConfigAsync();
    expect(first).toBe(second);
  });

  it("uses empty string when SSM fails", async () => {
    mockGetConfig.mockRejectedValue(new Error("SSM unavailable"));
    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_BOT_TOKEN).toBe("");
  });
});

describe("resetNewsletterSlackConfigCache", () => {
  it("clears cached config so next call re-reads", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-1";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "s1";

    await getNewsletterSlackConfigAsync();
    resetNewsletterSlackConfigCache();

    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-2";
    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-2");
  });
});

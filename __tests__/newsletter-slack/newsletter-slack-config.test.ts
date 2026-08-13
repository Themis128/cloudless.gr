/**
 * Unit tests for the dedicated Newsletter Slack config loader.
 *
 * Verifies env-first then SSM-fallback resolution, and that the cache
 * is properly invalidated by resetNewsletterSlackConfigCache().
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getNewsletterSlackConfigAsync,
  resetNewsletterSlackConfigCache,
} from "@/lib/newsletter-slack-config";

beforeEach(() => {
  resetNewsletterSlackConfigCache();
  delete process.env.NEWSLETTER_SLACK_BOT_TOKEN;
  delete process.env.NEWSLETTER_SLACK_SIGNING_SECRET;
  delete process.env.NEWSLETTER_SLACK_CHANNEL_ID;
  vi.restoreAllMocks();
});

describe("getNewsletterSlackConfigAsync", () => {
  it("returns env values when all three are set", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-from-env";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "signing-from-env";
    process.env.NEWSLETTER_SLACK_CHANNEL_ID = "C-from-env";
    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg).toEqual({
      NEWSLETTER_SLACK_BOT_TOKEN: "xoxb-from-env",
      NEWSLETTER_SLACK_SIGNING_SECRET: "signing-from-env",
      NEWSLETTER_SLACK_CHANNEL_ID: "C-from-env",
    });
  });

  it("defaults channel to #newsletter id when nothing is set", async () => {
    // SSM import will fail with no mock — that's the expected SSM-unavailable
    // fallback path; bot/signing stay empty, channel falls back to live ops id.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = await getNewsletterSlackConfigAsync();
    expect(cfg.NEWSLETTER_SLACK_BOT_TOKEN).toBe("");
    expect(cfg.NEWSLETTER_SLACK_SIGNING_SECRET).toBe("");
    expect(cfg.NEWSLETTER_SLACK_CHANNEL_ID).toBe("C0BBDKY6Q9E");
    // Should have warned about the missing signing secret (runtime / tests)
    expect(warn).toHaveBeenCalled();
  });

  it("does not warn about missing secret during next production build", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NEXT_PHASE = "phase-production-build";
    try {
      const cfg = await getNewsletterSlackConfigAsync();
      expect(cfg.NEWSLETTER_SLACK_SIGNING_SECRET).toBe("");
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining("NEWSLETTER_SLACK_SIGNING_SECRET not set")
      );
    } finally {
      delete process.env.NEXT_PHASE;
    }
  });

  it("caches results — second call does not re-read env", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-first";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "secret-first";
    const a = await getNewsletterSlackConfigAsync();
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-second";
    const b = await getNewsletterSlackConfigAsync();
    expect(b).toBe(a); // same object reference — cache hit
    expect(b.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-first");
  });

  it("resetNewsletterSlackConfigCache() invalidates the cache", async () => {
    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-v1";
    process.env.NEWSLETTER_SLACK_SIGNING_SECRET = "v1";
    const a = await getNewsletterSlackConfigAsync();
    expect(a.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-v1");

    process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-v2";
    resetNewsletterSlackConfigCache();
    const b = await getNewsletterSlackConfigAsync();
    expect(b.NEWSLETTER_SLACK_BOT_TOKEN).toBe("xoxb-v2");
  });
});

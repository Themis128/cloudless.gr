import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  getIntegrations,
  isConfigured,
  IntegrationNotConfiguredError,
  getSlackConfig,
  resetIntegrationCache,
  resetIntegrationCacheAsync,
  resetSlackConfigCache,
} from "@/lib/integrations";

beforeEach(() => {
  resetIntegrationCache();
  resetIntegrationCacheAsync();
  resetSlackConfigCache();
});

afterEach(() => {
  resetIntegrationCache();
  resetIntegrationCacheAsync();
  resetSlackConfigCache();
});

describe("getIntegrations", () => {
  it("returns an object with optional string values from env", () => {
    const cfg = getIntegrations();
    expect(typeof cfg).toBe("object");
    expect(cfg).not.toBeNull();
  });

  it("picks up a newly set env var after cache reset", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-testonly";
    resetIntegrationCache();
    const cfg = getIntegrations();
    expect(cfg.SLACK_BOT_TOKEN).toBe("xoxb-testonly");
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("caches results — same reference on second call", () => {
    const a = getIntegrations();
    const b = getIntegrations();
    expect(a).toBe(b);
  });
});

describe("isConfigured", () => {
  it("returns false for a key not present in env", () => {
    delete process.env.NOTION_API_KEY;
    resetIntegrationCache();
    expect(isConfigured("NOTION_API_KEY")).toBe(false);
  });

  it("returns true when all specified keys are present", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-abc";
    process.env.SLACK_SIGNING_SECRET = "signsecret";
    resetIntegrationCache();
    expect(isConfigured("SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET")).toBe(true);
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
  });

  it("returns false when any of the specified keys is missing", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-abc";
    delete process.env.SLACK_SIGNING_SECRET;
    resetIntegrationCache();
    expect(isConfigured("SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET")).toBe(false);
    delete process.env.SLACK_BOT_TOKEN;
  });
});

describe("IntegrationNotConfiguredError", () => {
  it("is an Error instance with correct name and keys", () => {
    const err = new IntegrationNotConfiguredError(["NOTION_API_KEY", "STRIPE_SECRET_KEY"]);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("IntegrationNotConfiguredError");
    expect(err.keys).toEqual(["NOTION_API_KEY", "STRIPE_SECRET_KEY"]);
    expect(err.message).toContain("NOTION_API_KEY");
  });
});

describe("getSlackConfig", () => {
  it("returns an object with Slack-specific keys", () => {
    const cfg = getSlackConfig();
    expect("SLACK_BOT_TOKEN" in cfg).toBe(true);
    expect("SLACK_WEBHOOK_URL" in cfg).toBe(true);
    expect("SLACK_SIGNING_SECRET" in cfg).toBe(true);
  });

  it("returns the configured token from env", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-slack-test";
    resetSlackConfigCache();
    const cfg = getSlackConfig();
    expect(cfg.SLACK_BOT_TOKEN).toBe("xoxb-slack-test");
    delete process.env.SLACK_BOT_TOKEN;
  });
});

describe("cache reset functions", () => {
  it("resetIntegrationCache does not throw", () => {
    expect(() => resetIntegrationCache()).not.toThrow();
  });

  it("resetIntegrationCacheAsync does not throw", () => {
    expect(() => resetIntegrationCacheAsync()).not.toThrow();
  });

  it("resetSlackConfigCache does not throw", () => {
    expect(() => resetSlackConfigCache()).not.toThrow();
  });
});

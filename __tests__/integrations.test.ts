import { describe, it, expect, beforeEach } from "vitest";
import {
  getIntegrations,
  isConfigured,
  getIntegrationsAsync,
  isConfiguredAsync,
  getSlackConfig,
  resetIntegrationCache,
} from "@/lib/integrations";

describe("integrations.ts", () => {
  beforeEach(() => {
    resetIntegrationCache();
  });

  describe("getIntegrations()", () => {
    it("reads NOTION_API_KEY from env", () => {
      expect(getIntegrations().NOTION_API_KEY).toBe("secret_test_key_12345");
    });

    it("reads HUBSPOT_API_KEY from env", () => {
      expect(getIntegrations().HUBSPOT_API_KEY).toBe("test-hs-token");
    });

    it("defaults SENTRY_ORG to baltzakisthemiscom when env var not set", () => {
      expect(getIntegrations().SENTRY_ORG).toBe("baltzakisthemiscom");
    });

    it("defaults SENTRY_PROJECT to cloudless-gr when env var not set", () => {
      expect(getIntegrations().SENTRY_PROJECT).toBe("cloudless-gr");
    });

    it("normalizes GOOGLE_PRIVATE_KEY escaped newlines", () => {
      process.env.GOOGLE_PRIVATE_KEY = "key\\nline2";
      resetIntegrationCache();
      expect(getIntegrations().GOOGLE_PRIVATE_KEY).toBe("key\nline2");
    });

    it("caches result across multiple calls", () => {
      const first = getIntegrations();
      const second = getIntegrations();
      expect(first).toBe(second);
    });

    it("re-reads env after resetIntegrationCache()", () => {
      getIntegrations();
      process.env.NOTION_API_KEY = "changed-key";
      resetIntegrationCache();
      expect(getIntegrations().NOTION_API_KEY).toBe("changed-key");
      process.env.NOTION_API_KEY = "secret_test_key_12345";
    });
  });

  describe("isConfigured()", () => {
    it("returns true when single key has a value", () => {
      expect(isConfigured("NOTION_API_KEY")).toBe(true);
    });

    it("returns false when single key is absent or empty", () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      expect(isConfigured("NOTION_API_KEY")).toBe(false);
      process.env.NOTION_API_KEY = "secret_test_key_12345";
    });

    it("returns true when all specified keys have values", () => {
      expect(isConfigured("NOTION_API_KEY", "HUBSPOT_API_KEY")).toBe(true);
    });

    it("returns false when any specified key is missing", () => {
      // SENTRY_AUTH_TOKEN is not set globally
      expect(isConfigured("NOTION_API_KEY", "SENTRY_AUTH_TOKEN")).toBe(false);
    });
  });

  describe("getIntegrationsAsync()", () => {
    it("returns NOTION_API_KEY from env", async () => {
      const cfg = await getIntegrationsAsync();
      expect(cfg.NOTION_API_KEY).toBe("secret_test_key_12345");
    });

    it("takes fast path when all critical keys are present in env", async () => {
      process.env.SENTRY_AUTH_TOKEN = "sntrys_test";
      resetIntegrationCache();
      const cfg = await getIntegrationsAsync();
      expect(cfg.SENTRY_AUTH_TOKEN).toBe("sntrys_test");
      delete process.env.SENTRY_AUTH_TOKEN;
    });

    it("falls back gracefully when SSM is unavailable (test mode reads env)", async () => {
      const cfg = await getIntegrationsAsync();
      expect(cfg.HUBSPOT_API_KEY).toBe("test-hs-token");
    });

    it("caches async result across calls", async () => {
      const first = await getIntegrationsAsync();
      const second = await getIntegrationsAsync();
      expect(first).toBe(second);
    });
  });

  describe("isConfiguredAsync()", () => {
    it("returns false immediately when env var is explicitly empty string", async () => {
      process.env.NOTION_API_KEY = "";
      expect(await isConfiguredAsync("NOTION_API_KEY")).toBe(false);
      process.env.NOTION_API_KEY = "secret_test_key_12345";
    });

    it("returns true when key is configured", async () => {
      expect(await isConfiguredAsync("NOTION_API_KEY")).toBe(true);
    });

    it("returns false when env var is cleared before resolution", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      expect(await isConfiguredAsync("NOTION_API_KEY")).toBe(false);
      process.env.NOTION_API_KEY = "secret_test_key_12345";
    });
  });

  describe("getSlackConfig()", () => {
    it("returns SLACK_BOT_TOKEN from env", () => {
      expect(getSlackConfig().SLACK_BOT_TOKEN).toBe("xoxb-test-token");
    });

    it("returns SLACK_SIGNING_SECRET from env", () => {
      expect(getSlackConfig().SLACK_SIGNING_SECRET).toBe("test-signing-secret-32chars-padded");
    });

    it("returns empty string for SLACK_WEBHOOK_URL when not set", () => {
      expect(getSlackConfig().SLACK_WEBHOOK_URL).toBe("");
    });

    it("returns SLACK_WEBHOOK_URL when set", () => {
      process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
      resetIntegrationCache();
      expect(getSlackConfig().SLACK_WEBHOOK_URL).toBe("https://hooks.slack.com/services/test");
    });

    it("caches Slack config across calls", () => {
      const first = getSlackConfig();
      const second = getSlackConfig();
      expect(first).toBe(second);
    });
  });
});

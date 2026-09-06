import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("./ssm-config-d1", () => ({
  isWorkersEnvironment: vi.fn().mockReturnValue(false),
  getD1Config: vi.fn().mockResolvedValue({}),
}));

import { resetSsmCache, getConfig } from "@/lib/ssm-config";

beforeEach(() => {
  resetSsmCache();
});

afterEach(() => {
  resetSsmCache();
});

describe("resetSsmCache", () => {
  it("does not throw", () => {
    expect(() => resetSsmCache()).not.toThrow();
  });
});

describe("getConfig", () => {
  it("returns an AppConfig object with string values", async () => {
    const cfg = await getConfig();
    expect(typeof cfg).toBe("object");
    expect(cfg).not.toBeNull();
    expect(typeof cfg.SES_FROM_EMAIL).toBe("string");
    expect(typeof cfg.SENTRY_ORG).toBe("string");
  });

  it("uses default SENTRY_ORG when env var is not set", async () => {
    delete process.env.SENTRY_ORG;
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.SENTRY_ORG).toBe("baltzakisthemiscom");
  });

  it("uses default SES_FROM_EMAIL when env var is not set", async () => {
    delete process.env.SES_FROM_EMAIL;
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.SES_FROM_EMAIL).toBe("noreply@cloudless.gr");
  });

  it("picks up an env var value when set", async () => {
    process.env.NOTION_BLOG_DB_ID = "notion-test-id";
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.NOTION_BLOG_DB_ID).toBe("notion-test-id");
    delete process.env.NOTION_BLOG_DB_ID;
  });

  it("caches the result — same reference on second call", async () => {
    const a = await getConfig();
    const b = await getConfig();
    expect(a).toBe(b);
  });
});

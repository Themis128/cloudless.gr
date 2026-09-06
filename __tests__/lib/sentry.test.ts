import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

import {
  __resetSentryRejectionCache,
  isSentryConfigured,
  verifySentryToken,
  getTopErrors,
} from "@/lib/sentry";

beforeEach(() => {
  __resetSentryRejectionCache();
  mockGetCfg.mockResolvedValue({ SENTRY_AUTH_TOKEN: "", SENTRY_ORG: "", SENTRY_PROJECT: "" });
  vi.clearAllMocks();
});

describe("isSentryConfigured", () => {
  it("returns false when SENTRY_AUTH_TOKEN is not set", async () => {
    const result = await isSentryConfigured();
    expect(result).toBe(false);
  });

  it("returns true when SENTRY_AUTH_TOKEN is present", async () => {
    mockGetCfg.mockResolvedValue({
      SENTRY_AUTH_TOKEN: "sntryu_test",
      SENTRY_ORG: "myorg",
      SENTRY_PROJECT: "myproject",
    });
    const result = await isSentryConfigured();
    expect(result).toBe(true);
  });
});

describe("verifySentryToken", () => {
  it("returns not_configured when token is empty", async () => {
    const result = await verifySentryToken();
    expect(result.status).toBe("not_configured");
  });
});

describe("getTopErrors", () => {
  it("returns empty array when Sentry is not configured", async () => {
    const result = await getTopErrors();
    expect(result).toEqual([]);
  });
});

describe("__resetSentryRejectionCache", () => {
  it("does not throw", () => {
    expect(() => __resetSentryRejectionCache()).not.toThrow();
  });
});

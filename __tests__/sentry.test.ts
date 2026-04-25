import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsConfiguredAsync = vi.fn();
const mockGetIntegrationsAsync = vi.fn();

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...args: unknown[]) => mockIsConfiguredAsync(...args),
  getIntegrationsAsync: () => mockGetIntegrationsAsync(),
  resetIntegrationCache: vi.fn(),
  resetIntegrationCacheAsync: vi.fn(),
}));

const CONFIGURED_INTEGRATIONS = {
  SENTRY_AUTH_TOKEN: "sntrys_test_token",
  SENTRY_ORG: "test-org",
  SENTRY_PROJECT: "test-project",
};

function makeSentryIssue(overrides = {}) {
  return {
    id: "issue-1",
    title: "TypeError: Cannot read property",
    culprit: "src/lib/test.ts",
    level: "error",
    count: "42",
    userCount: 5,
    firstSeen: "2026-04-01T00:00:00Z",
    lastSeen: "2026-04-25T00:00:00Z",
    status: "unresolved",
    permalink: "https://sentry.io/issues/1/",
    shortId: "TEST-1A2B",
    metadata: {},
    ...overrides,
  };
}

describe("sentry.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED_INTEGRATIONS);
  });

  describe("isSentryConfigured()", () => {
    it("returns true when SENTRY_AUTH_TOKEN is configured", async () => {
      const { isSentryConfigured } = await import("@/lib/sentry");
      const result = await isSentryConfigured();
      expect(result).toBe(true);
      expect(mockIsConfiguredAsync).toHaveBeenCalledWith("SENTRY_AUTH_TOKEN");
    });

    it("returns false when SENTRY_AUTH_TOKEN is not configured", async () => {
      mockIsConfiguredAsync.mockResolvedValueOnce(false);
      const { isSentryConfigured } = await import("@/lib/sentry");
      const result = await isSentryConfigured();
      expect(result).toBe(false);
    });
  });

  describe("getUnresolvedIssues()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockIsConfiguredAsync.mockResolvedValueOnce(false);
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      const result = await getUnresolvedIssues();
      expect(result).toBeNull();
    });

    it("returns issue list with total and fetchedAt", async () => {
      const issues = [makeSentryIssue(), makeSentryIssue({ id: "issue-2" })];
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      const result = await getUnresolvedIssues();
      expect(result).not.toBeNull();
      expect(result!.issues).toHaveLength(2);
      expect(result!.total).toBe(2);
      expect(result!.fetchedAt).toBeTruthy();
    });

    it("returns null when fetch fails", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network error"));
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      const result = await getUnresolvedIssues();
      expect(result).toBeNull();
    });

    it("returns null when API returns 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      const result = await getUnresolvedIssues();
      expect(result).toBeNull();
    });
  });

  describe("getTopErrors()", () => {
    it("returns empty array when Sentry is not configured", async () => {
      mockIsConfiguredAsync.mockResolvedValueOnce(false);
      const { getTopErrors } = await import("@/lib/sentry");
      const result = await getTopErrors();
      expect(result).toEqual([]);
    });

    it("returns issues from getUnresolvedIssues", async () => {
      const issues = [makeSentryIssue()];
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );
      const { getTopErrors } = await import("@/lib/sentry");
      const result = await getTopErrors(1);
      expect(result).toHaveLength(1);
    });
  });

  describe("getErrorCounts()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockIsConfiguredAsync.mockResolvedValueOnce(false);
      const { getErrorCounts } = await import("@/lib/sentry");
      expect(await getErrorCounts()).toBeNull();
    });

    it("counts issues by severity level", async () => {
      const issues = [
        makeSentryIssue({ level: "fatal" }),
        makeSentryIssue({ level: "error" }),
        makeSentryIssue({ level: "error" }),
        makeSentryIssue({ level: "warning" }),
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );
      const { getErrorCounts } = await import("@/lib/sentry");
      const result = await getErrorCounts();
      expect(result).not.toBeNull();
      expect(result!.fatal).toBe(1);
      expect(result!.error).toBe(2);
      expect(result!.warning).toBe(1);
      expect(result!.total).toBe(4);
    });
  });

  describe("updateIssueStatus()", () => {
    it("returns true when patch succeeds", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "resolved" }), { status: 200 }),
      );
      const { updateIssueStatus } = await import("@/lib/sentry");
      expect(await updateIssueStatus("issue-1", "resolved")).toBe(true);
    });

    it("returns false when API returns a different status", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "unresolved" }), { status: 200 }),
      );
      const { updateIssueStatus } = await import("@/lib/sentry");
      expect(await updateIssueStatus("issue-1", "resolved")).toBe(false);
    });
  });
});

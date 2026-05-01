import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

const CONFIGURED_CONFIG = {
  SENTRY_AUTH_TOKEN: "sntrys_test_token",
  SENTRY_ORG: "baltzakisthemiscom",
  SENTRY_PROJECT: "cloudless-gr",
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
    shortId: "CLOUDLESS-GR-1A2B",
    metadata: {},
    ...overrides,
  };
}

describe("sentry.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockGetConfig.mockResolvedValue(CONFIGURED_CONFIG);
  });

  // ── isSentryConfigured ───────────────────────────────────────────────────────

  describe("isSentryConfigured()", () => {
    it("returns true when SENTRY_AUTH_TOKEN is configured", async () => {
      const { isSentryConfigured } = await import("@/lib/sentry");
      expect(await isSentryConfigured()).toBe(true);
    });

    it("returns false when SENTRY_AUTH_TOKEN is not configured", async () => {
      mockGetConfig.mockResolvedValueOnce({ ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" });
      const { isSentryConfigured } = await import("@/lib/sentry");
      expect(await isSentryConfigured()).toBe(false);
    });
  });

  // ── verifySentryToken ────────────────────────────────────────────────────────

  describe("verifySentryToken()", () => {
    it("returns not_configured when SENTRY_AUTH_TOKEN is missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" });
      const { verifySentryToken } = await import("@/lib/sentry");
      const result = await verifySentryToken();
      expect(result.status).toBe("not_configured");
    });

    it("returns valid on 200", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("{}", { status: 200 }),
      );
      const { verifySentryToken } = await import("@/lib/sentry");
      const result = await verifySentryToken();
      expect(result.status).toBe("valid");
    });

    it("returns rejected on 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );
      const { verifySentryToken } = await import("@/lib/sentry");
      const result = await verifySentryToken();
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/401/);
    });

    it("returns error on non-auth failure", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 500 }),
      );
      const { verifySentryToken } = await import("@/lib/sentry");
      const result = await verifySentryToken();
      expect(result.status).toBe("error");
    });
  });

  // ── getUnresolvedIssues ──────────────────────────────────────────────────────

  describe("getUnresolvedIssues()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue({ ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" });
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      expect(await getUnresolvedIssues()).toBeNull();
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
      expect(await getUnresolvedIssues()).toBeNull();
    });

    it("returns null when API returns 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("", { status: 401 }),
      );
      const { getUnresolvedIssues } = await import("@/lib/sentry");
      expect(await getUnresolvedIssues()).toBeNull();
    });
  });

  // ── getTopErrors ─────────────────────────────────────────────────────────────

  describe("getTopErrors()", () => {
    it("returns empty array when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue({ ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" });
      const { getTopErrors } = await import("@/lib/sentry");
      expect(await getTopErrors()).toEqual([]);
    });

    it("returns issues from getUnresolvedIssues", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify([makeSentryIssue()]), { status: 200 }),
      );
      const { getTopErrors } = await import("@/lib/sentry");
      expect(await getTopErrors(1)).toHaveLength(1);
    });
  });

  // ── getErrorCounts ────────────────────────────────────────────────────────────

  describe("getErrorCounts()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue({ ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" });
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

  // ── updateIssueStatus ─────────────────────────────────────────────────────────

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

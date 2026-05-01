import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

import {
  isSentryConfigured,
  verifySentryToken,
  getUnresolvedIssues,
  getTopErrors,
  getErrorCounts,
  updateIssueStatus,
} from "@/lib/sentry";

const CONFIGURED_CONFIG = {
  SENTRY_AUTH_TOKEN: "sntrys_test_token",
  SENTRY_ORG: "baltzakisthemiscom",
  SENTRY_PROJECT: "cloudless-gr",
};

const UNCONFIGURED = { ...CONFIGURED_CONFIG, SENTRY_AUTH_TOKEN: "" };
const STATUS_RESOLVED = "resolved";
const ISSUE_ID = "issue-1";

function makeSentryIssue(overrides = {}) {
  return {
    id: ISSUE_ID,
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
      expect(await isSentryConfigured()).toBe(true);
    });

    it("returns false when SENTRY_AUTH_TOKEN is not configured", async () => {
      mockGetConfig.mockResolvedValueOnce(UNCONFIGURED);
      expect(await isSentryConfigured()).toBe(false);
    });
  });

  // ── verifySentryToken ────────────────────────────────────────────────────────

  describe("verifySentryToken()", () => {
    it("returns not_configured when SENTRY_AUTH_TOKEN is missing", async () => {
      mockGetConfig.mockResolvedValueOnce(UNCONFIGURED);
      const result = await verifySentryToken();
      expect(result.status).toBe("not_configured");
    });

    it("returns valid on 200", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));
      const result = await verifySentryToken();
      expect(result.status).toBe("valid");
    });

    it("returns rejected on 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 401 }));
      const result = await verifySentryToken();
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/401/);
    });

    it("returns error on non-auth failure", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 500 }));
      const result = await verifySentryToken();
      expect(result.status).toBe("error");
    });
  });

  // ── getUnresolvedIssues ──────────────────────────────────────────────────────

  describe("getUnresolvedIssues()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue(UNCONFIGURED);
      expect(await getUnresolvedIssues()).toBeNull();
    });

    it("returns issue list with total and fetchedAt", async () => {
      const issues = [makeSentryIssue(), makeSentryIssue({ id: "issue-2" })];
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );
      const result = await getUnresolvedIssues();
      expect(result).not.toBeNull();
      expect(result!.issues).toHaveLength(2);
      expect(result!.total).toBe(2);
      expect(result!.fetchedAt).toBeTruthy();
    });

    it("returns null when fetch fails", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network error"));
      expect(await getUnresolvedIssues()).toBeNull();
    });

    it("returns null when API returns 401", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 401 }));
      expect(await getUnresolvedIssues()).toBeNull();
    });
  });

  // ── getTopErrors ─────────────────────────────────────────────────────────────

  describe("getTopErrors()", () => {
    it("returns empty array when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue(UNCONFIGURED);
      expect(await getTopErrors()).toEqual([]);
    });

    it("returns issues from getUnresolvedIssues", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify([makeSentryIssue()]), { status: 200 }),
      );
      expect(await getTopErrors(1)).toHaveLength(1);
    });
  });

  // ── getErrorCounts ────────────────────────────────────────────────────────────

  describe("getErrorCounts()", () => {
    it("returns null when Sentry is not configured", async () => {
      mockGetConfig.mockResolvedValue(UNCONFIGURED);
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
        new Response(JSON.stringify({ status: STATUS_RESOLVED }), { status: 200 }),
      );
      expect(await updateIssueStatus(ISSUE_ID, STATUS_RESOLVED)).toBe(true);
    });

    it("returns false when API returns a different status", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "unresolved" }), { status: 200 }),
      );
      expect(await updateIssueStatus(ISSUE_ID, STATUS_RESOLVED)).toBe(false);
    });
  });
});

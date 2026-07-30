import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});
const { getConfigMock, getSnapshotMock, runOrchestrationMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  runOrchestrationMock: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/lib/stripe-analytics-read", () => ({
  getStripeAnalyticsSnapshot: getSnapshotMock,
}));

vi.mock("@/lib/analytics-agent-orchestrator", () => ({
  runAnalyticsAgentOrchestration: runOrchestrationMock,
}));

function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(body?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai/analytics-orchestration", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
}

function unauthReq(): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai/analytics-orchestration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("POST /api/admin/ai/analytics-orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({
      ANTHROPIC_API_KEY: "test-anthropic-key",
    });
    getSnapshotMock.mockResolvedValue({
      windowDays: 30,
      generatedAt: new Date().toISOString(),
      totals: { events: 3, revenueMinor: 4500, processed: 2, failed: 1 },
      byCategory: { checkout: { events: 2, revenueMinor: 4500 } },
      byStatus: { processed: 2, handler_failed: 1 },
      byCurrency: { eur: 4500 },
      dailyTrend: [
        {
          day: "2026-05-01",
          revenueMinor: 2000,
          events: 1,
          processed: 1,
          failed: 0,
        },
        {
          day: "2026-05-02",
          revenueMinor: 2500,
          events: 2,
          processed: 1,
          failed: 1,
        },
      ],
    });
    runOrchestrationMock.mockResolvedValue({
      workflow: [
        { step: "collect_data", status: "completed", details: "ok" },
        { step: "preprocess_data", status: "completed", details: "ok" },
        { step: "generate_insights", status: "completed", details: "ok" },
        { step: "prepare_connectors", status: "completed", details: "ok" },
      ],
      snapshot: {
        windowDays: 30,
        generatedAt: new Date().toISOString(),
        totals: { events: 3, revenueMinor: 4500, processed: 2, failed: 1 },
        byCategory: { checkout: { events: 2, revenueMinor: 4500 } },
        byStatus: { processed: 2, handler_failed: 1 },
        byCurrency: { eur: 4500 },
        dailyTrend: [],
      },
      preprocessed: {
        windowDays: 30,
        hasData: true,
        failureRatePct: 33.33,
        processedRatePct: 66.67,
        averageRevenuePerEventMinor: 1500,
        averageDailyRevenueMinor: 2250,
        averageDailyEvents: 1.5,
        revenuePerProcessedEventMinor: 2250,
        topRevenueCategories: [
          {
            category: "checkout",
            events: 2,
            revenueMinor: 4500,
            revenueSharePct: 100,
          },
        ],
        topFailureDays: [{ day: "2026-05-02", failed: 1, events: 2, failureRatePct: 50 }],
        strongestRevenueDays: [{ day: "2026-05-02", revenueMinor: 2500, events: 2 }],
        momentum: {
          comparisonWindowDays: 2,
          recentRevenueMinor: 4500,
          priorRevenueMinor: null,
          revenueDeltaPct: null,
          recentFailureRatePct: 33.33,
          priorFailureRatePct: null,
          failureRateDeltaPct: null,
        },
        dataQuality: {
          sparseWindow: true,
          notes: ["Sample size is sparse for the selected window."],
        },
      },
      report: {
        executiveSummary: "test summary",
        keyInsights: ["a", "b"],
        risks: ["r1"],
        nextMoves: [],
        scenarioOutcomes: [],
      },
      connectorPayloads: [],
    });
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(unauthReq());
    expect(response.status).toBe(401);
  });

  it("returns 400 when windowDays is invalid", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 0 }));
    expect(response.status).toBe(400);
  });

  it("returns 503 when ANTHROPIC_API_KEY is missing", async () => {
    getConfigMock.mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 30 }));
    expect(response.status).toBe(503);
  });

  it("returns orchestrated analytics report with connector payloads", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(
      adminReq({
        windowDays: 14,
        connectors: ["quicksight", "powerbi"],
        goals: ["Increase retained revenue"],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getSnapshotMock).toHaveBeenCalledWith(14);
    expect(runOrchestrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectors: ["quicksight", "powerbi"],
        goals: ["Increase retained revenue"],
      })
    );
    expect(data.report).toBeDefined();
    expect(data.workflow).toBeDefined();
  });

  it("returns 500 when orchestration step fails", async () => {
    runOrchestrationMock.mockRejectedValue(new Error("orchestration boom"));
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 30 }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Analytics orchestration failed.");
  });
});

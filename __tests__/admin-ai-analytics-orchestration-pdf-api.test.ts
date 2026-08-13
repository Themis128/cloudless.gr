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

const {
  getStripeSnapshotFromLakeMock,
  getInsightMock,
  runOrchestrationMock,
  preprocessMock,
} = vi.hoisted(() => ({
  getStripeSnapshotFromLakeMock: vi.fn(),
  getInsightMock: vi.fn(),
  runOrchestrationMock: vi.fn(),
  preprocessMock: vi.fn(),
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

vi.mock("@/lib/datalake-serve", () => ({
  getStripeSnapshotFromLake: (...a: unknown[]) => getStripeSnapshotFromLakeMock(...a),
  getInsight: (...a: unknown[]) => getInsightMock(...a),
}));

vi.mock("@/lib/analytics-agent-orchestrator", () => ({
  runAnalyticsAgentOrchestration: (...a: unknown[]) => runOrchestrationMock(...a),
  preprocessStripeAnalyticsSnapshot: (...a: unknown[]) => preprocessMock(...a),
}));

vi.mock("@/lib/admin-ai", () => ({
  isAdminAiConfiguredAsync: vi.fn(async () => true),
  adminAiNotConfiguredResponse: () =>
    Response.json({ error: "Admin AI not configured." }, { status: 503 }),
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn(() => null),
}));

const SAMPLE_LAKE_SNAP = {
  windowDays: 30,
  generatedAt: "2026-05-03T12:00:00.000Z",
  totals: { events: 3, revenueMinor: 4500, processed: 2, failed: 1 },
  byCategory: { checkout: { events: 2, revenueMinor: 4500 } },
  byStatus: { processed: 2, handler_failed: 1 },
  byCurrency: { eur: 4500 },
  dailyTrend: [
    { day: "2026-05-01", revenueMinor: 2000, events: 1, processed: 1, failed: 0 },
    { day: "2026-05-02", revenueMinor: 2500, events: 2, processed: 1, failed: 1 },
  ],
  source: "datalake-gold" as const,
};

const SAMPLE_PREPROCESSED = {
  windowDays: 30,
  hasData: true,
  failureRatePct: 33.33,
  processedRatePct: 66.67,
  averageRevenuePerEventMinor: 1500,
  averageDailyRevenueMinor: 2250,
  averageDailyEvents: 1.5,
  revenuePerProcessedEventMinor: 2250,
  topRevenueCategories: [
    { category: "checkout", events: 2, revenueMinor: 4500, revenueSharePct: 100 },
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
};

const CACHED_ORCHESTRATION_INSIGHT = {
  domain: "orchestration",
  summary: "Cached lake orchestration summary",
  bullets: ["Revenue stable", "Investigate failures"],
  generated_at: "2026-05-03T10:00:00.000Z",
};

function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(body?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai/analytics-orchestration/pdf", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
}

describe("POST /api/admin/ai/analytics-orchestration/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStripeSnapshotFromLakeMock.mockResolvedValue(SAMPLE_LAKE_SNAP);
    getInsightMock.mockResolvedValue(CACHED_ORCHESTRATION_INSIGHT);
    preprocessMock.mockReturnValue(SAMPLE_PREPROCESSED);
    runOrchestrationMock.mockResolvedValue({
      workflow: [
        { step: "collect_data", status: "completed", details: "ok" },
        { step: "preprocess_data", status: "completed", details: "ok" },
        { step: "generate_insights", status: "completed", details: "ok" },
        { step: "prepare_connectors", status: "completed", details: "ok" },
      ],
      snapshot: SAMPLE_LAKE_SNAP,
      preprocessed: SAMPLE_PREPROCESSED,
      report: {
        executiveSummary: "live llm summary",
        keyInsights: ["a", "b"],
        risks: ["r1"],
        nextMoves: [
          {
            move: "Investigate failures",
            rationale: "Failures are recoverable",
            expectedOutcome: "Lower failure rate",
            confidence: "high",
            timeframeDays: 7,
          },
        ],
        scenarioOutcomes: [
          {
            scenario: "Reduce failures",
            expectedRevenueDeltaPct: 3,
            expectedConversionDeltaPct: 2,
          },
        ],
      },
      connectorPayloads: [
        {
          connector: "quicksight",
          datasets: {
            dailyTrend: [],
            categoryBreakdown: { checkout: { events: 2, revenueMinor: 4500 } },
            statusBreakdown: { processed: 2, handler_failed: 1 },
            currencyBreakdown: { eur: 4500 },
          },
          summaryMetrics: {
            failureRatePct: 33.33,
            processedRatePct: 66.67,
            averageRevenuePerEventMinor: 1500,
            revenueDeltaPct: null,
            failureRateDeltaPct: null,
            topRevenueCategories: ["checkout"],
            dataQualityNotes: ["Sample size is sparse for the selected window."],
          },
          chartRecommendations: ["Line chart: daily revenue and failed events trend"],
          serviceHints: ["Use SPICE ingestion for daily snapshots."],
        },
      ],
    });
  });

  it("returns a PDF download from cached lake orchestration insight", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/pdf/route");
    const response = await POST(adminReq({ reportTitle: "Executive Stripe Report" }));

    expect(response.status).toBe(200);
    expect(getStripeSnapshotFromLakeMock).toHaveBeenCalled();
    expect(getInsightMock).toHaveBeenCalledWith("orchestration");
    expect(runOrchestrationMock).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(
      "analytics-report-2026-05-03.pdf"
    );

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBeGreaterThan(500);
  });

  it("returns a PDF via live_llm when requested", async () => {
    getInsightMock.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/pdf/route");
    const response = await POST(
      adminReq({ reportTitle: "Executive Stripe Report", live_llm: true })
    );

    expect(response.status).toBe(200);
    expect(runOrchestrationMock).toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("falls back to defaults when reportTitle is blank (parse errors are swallowed)", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/pdf/route");
    const response = await POST(adminReq({ reportTitle: "   ", connectors: [] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(getStripeSnapshotFromLakeMock).toHaveBeenCalledWith(30);
  });
});

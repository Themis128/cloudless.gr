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
  bullets: ["Revenue stable", "Failures elevated on 2026-05-02"],
  generated_at: "2026-05-03T10:00:00.000Z",
};

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

  it("serves cached orchestration insight without calling live LLM", async () => {
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
    expect(getStripeSnapshotFromLakeMock).toHaveBeenCalledWith(14);
    expect(getInsightMock).toHaveBeenCalledWith("orchestration");
    expect(runOrchestrationMock).not.toHaveBeenCalled();
    expect(data.report.executiveSummary).toBe(CACHED_ORCHESTRATION_INSIGHT.summary);
    expect(data.report.keyInsights).toEqual(CACHED_ORCHESTRATION_INSIGHT.bullets);
    expect(data.workflow).toBeDefined();
    expect(data.preprocessed).toEqual(SAMPLE_PREPROCESSED);
  });

  it("falls back to defaults when windowDays is invalid (parse errors are swallowed)", async () => {
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 0 }));
    expect(response.status).toBe(200);
    expect(getStripeSnapshotFromLakeMock).toHaveBeenCalledWith(30);
  });

  it("returns 503 when live_llm is requested and Admin AI is missing", async () => {
    const adminAi = await import("@/lib/admin-ai");
    vi.mocked(adminAi.isAdminAiConfiguredAsync).mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 30, live_llm: true }));
    expect(response.status).toBe(503);
    expect(runOrchestrationMock).not.toHaveBeenCalled();
  });

  it("runs live orchestration when live_llm is true", async () => {
    getInsightMock.mockImplementation(async (domain: string) => {
      if (domain === "orchestration") return null;
      if (domain === "revenue") {
        return { domain: "revenue", summary: "MRR flat", bullets: [], generated_at: "2026-05-03T09:00:00.000Z" };
      }
      if (domain === "executive") {
        return {
          domain: "executive",
          summary: "Focus retention",
          bullets: [],
          generated_at: "2026-05-03T09:00:00.000Z",
        };
      }
      return null;
    });

    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(
      adminReq({
        windowDays: 14,
        live_llm: true,
        connectors: ["quicksight", "powerbi"],
        goals: ["Increase retained revenue"],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(runOrchestrationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectors: ["quicksight", "powerbi"],
        goals: expect.arrayContaining([
          "Increase retained revenue",
          expect.stringContaining("Lake revenue insight"),
          expect.stringContaining("Lake executive insight"),
        ]),
      })
    );
    expect(data.report.executiveSummary).toBe("live llm summary");
  });

  it("returns 500 when live orchestration step fails", async () => {
    runOrchestrationMock.mockRejectedValue(new Error("orchestration boom"));
    const { POST } = await import("@/app/api/admin/ai/analytics-orchestration/route");
    const response = await POST(adminReq({ windowDays: 30, live_llm: true }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Analytics orchestration failed.");
  });
});

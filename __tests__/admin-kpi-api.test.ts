import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockGetConfig,
  mockIsConfiguredAsync,
  mockGetAnalyticsSummary,
  mockGetSeoSnapshot,
  mockListProjects,
  mockGetTaskSummary,
  mockGetOverdueTasks,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockIsConfiguredAsync: vi.fn(),
  mockGetAnalyticsSummary: vi.fn(),
  mockGetSeoSnapshot: vi.fn(),
  mockListProjects: vi.fn(),
  mockGetTaskSummary: vi.fn(),
  mockGetOverdueTasks: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      if (payload.exp && Date.now() >= payload.exp * 1000)
        throw new Error("expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: mockIsConfiguredAsync,
  isConfigured: vi.fn().mockReturnValue(true),
  resetIntegrationCache: vi.fn(),
  getIntegrations: vi.fn().mockReturnValue({}),
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/notion-analytics", () => ({
  getAnalyticsSummary: mockGetAnalyticsSummary,
}));
vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: mockGetSeoSnapshot,
}));
vi.mock("@/lib/notion-projects", () => ({
  listProjects: mockListProjects,
  getTaskSummary: mockGetTaskSummary,
  getOverdueTasks: mockGetOverdueTasks,
}));

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeToken(groups: string[]): string {
  const payload = {
    sub: "user-sub",
    email: "user@test.com",
    "groups": groups,
    aud: "test-client",
    iss: "https://auth.cloudless.gr/realms/cloudless",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken(["admin"])}` },
  });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken([])}` },
  });
}

const BASE = "http://localhost/api/admin/kpi";

const SAMPLE_ANALYTICS = {
  totalEvents: 42,
  byType: { page_view: 30, blog_view: 8, form_submit: 4 },
  topPages: [{ page: "/", count: 20 }],
  topSources: [{ source: "direct", count: 15 }],
  recentEvents: [],
};

const SAMPLE_GSC = {
  clicks: 300,
  impressions: 5000,
  ctr: 6.0,
  avgPosition: 14.2,
  organicKeywords: 180,
};

const SAMPLE_PROJECTS = [
  { id: "p1", status: "In Progress", type: "Client" },
  { id: "p2", status: "Completed", type: "Client" },
  { id: "p3", status: "Planning", type: "Internal" },
  { id: "p4", status: "On Hold", type: "Client" },
];

const SAMPLE_TASK_SUMMARY = {
  "To Do": 5,
  "In Progress": 3,
  "In Review": 1,
  Done: 12,
  Blocked: 2,
  Backlog: 7,
};

const SAMPLE_OVERDUE = [
  { id: "t1", task: "Overdue task", dueDate: "2020-01-01" },
  { id: "t2", task: "Another overdue", dueDate: "2020-02-01" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/admin/kpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();

    // Default: everything configured
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "svc@test.iam",
      GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
    });
    mockGetAnalyticsSummary.mockResolvedValue(SAMPLE_ANALYTICS);
    mockGetSeoSnapshot.mockResolvedValue(SAMPLE_GSC);
    mockListProjects.mockResolvedValue(SAMPLE_PROJECTS);
    mockGetTaskSummary.mockResolvedValue(SAMPLE_TASK_SUMMARY);
    mockGetOverdueTasks.mockResolvedValue(SAMPLE_OVERDUE);
  });

  it("returns 401 without a token", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(userReq(BASE));
    expect(res.status).toBe(403);
  });

  it("returns 200 with all sections when everything is configured", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("analytics");
    expect(data).toHaveProperty("gsc");
    expect(data).toHaveProperty("projects");
    expect(data).toHaveProperty("tasks");
    expect(typeof data.fetchedAt).toBe("string");
  });

  it("returns correct analytics values", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.analytics.totalEvents).toBe(42);
    expect(data.analytics.byType.page_view).toBe(30);
  });

  it("returns correct GSC values", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.gsc.clicks).toBe(300);
    expect(data.gsc.organicKeywords).toBe(180);
  });

  it("returns correct project counts by status", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.projects.total).toBe(4);
    expect(data.projects.byStatus["In Progress"]).toBe(1);
    expect(data.projects.byStatus["Completed"]).toBe(1);
    expect(data.projects.byStatus["Planning"]).toBe(1);
    expect(data.projects.byStatus["On Hold"]).toBe(1);
    // activeCount = Planning + In Progress
    expect(data.projects.activeCount).toBe(2);
  });

  it("returns correct task summary and overdue count", async () => {
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.tasks.summary["Blocked"]).toBe(2);
    expect(data.tasks.summary["In Progress"]).toBe(3);
    expect(data.tasks.overdueCount).toBe(2);
  });

  // Test "returns null analytics when Notion analytics is not configured" was removed
  // 2026-06-21: src/app/api/admin/kpi/route.ts now hard-codes analyticsConf = true
  // because notion-analytics.ts is an Athena-backed no-op shim that always returns
  // empty data instead of throwing. The configured/not-configured branch no longer
  // exists in the route, so the test premise is invalid.

  it("returns null gsc when Google credentials are absent", async () => {
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: "",
    });

    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.gsc).toBeNull();
    expect(mockGetSeoSnapshot).not.toHaveBeenCalled();
  });

  it("returns empty projects when Notion projects not configured", async () => {
    mockIsConfiguredAsync.mockImplementation(
      async (...keys: string[]) => !keys.includes("NOTION_PROJECTS_DB_ID"),
    );

    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.projects.total).toBe(0);
    expect(data.projects.activeCount).toBe(0);
    expect(mockListProjects).not.toHaveBeenCalled();
  });

  it("returns zeroed tasks when Notion tasks not configured", async () => {
    mockIsConfiguredAsync.mockImplementation(
      async (...keys: string[]) => !keys.includes("NOTION_TASKS_DB_ID"),
    );

    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const data = await res.json();

    expect(data.tasks.overdueCount).toBe(0);
    expect(mockGetTaskSummary).not.toHaveBeenCalled();
    expect(mockGetOverdueTasks).not.toHaveBeenCalled();
  });

  it("still returns 200 when analytics source throws", async () => {
    mockGetAnalyticsSummary.mockRejectedValue(new Error("Notion timeout"));

    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);

    const data = await res.json();
    // allSettled — analytics will be null, others still present
    expect(data.analytics).toBeNull();
    expect(data.gsc).not.toBeNull();
  });

  it("still returns 200 when GSC source throws", async () => {
    mockGetSeoSnapshot.mockRejectedValue(new Error("GSC 503"));

    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.gsc).toBeNull();
    expect(data.analytics).not.toBeNull();
  });

  it("returns a valid ISO fetchedAt timestamp", async () => {
    const before = new Date().toISOString();
    const { GET } = await import("@/app/api/admin/kpi/route");
    const res = await GET(adminReq(BASE));
    const after = new Date().toISOString();
    const data = await res.json();

    expect(new Date(data.fetchedAt) >= new Date(before)).toBe(true);
    expect(new Date(data.fetchedAt) <= new Date(after)).toBe(true);
  });
});

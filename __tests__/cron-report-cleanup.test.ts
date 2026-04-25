import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSlackPost } = vi.hoisted(() => ({
  mockSlackPost: vi.fn(),
}));

const mockListReports = vi.fn();
const mockUpdateReport = vi.fn();

vi.mock("@/lib/reports", () => ({
  listReports: () => mockListReports(),
  updateReport: (...args: unknown[]) => mockUpdateReport(...args),
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn(function (this: { post: unknown }) {
    this.post = mockSlackPost;
  }),
}));

const CRON_SECRET = "test-cron-secret-report";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/cron/report-cleanup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

function makeReport(
  status: "generating" | "ready" | "error",
  ageMs: number,
  id = "report_1",
) {
  return {
    id,
    clientName: "Acme Corp",
    status,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    dateRange: { start: "2026-04-01", end: "2026-04-30" },
    sections: [],
  };
}

describe("GET /api/cron/report-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    mockSlackPost.mockResolvedValue(true);
    mockUpdateReport.mockResolvedValue({ id: "report_1", status: "error" });
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mockListReports).not.toHaveBeenCalled();
  });

  it("returns 401 when secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest("wrong-secret"));

    expect(res.status).toBe(401);
    expect(mockListReports).not.toHaveBeenCalled();
  });

  it("returns cleaned=0 and does not call Slack when no stale reports", async () => {
    mockListReports.mockResolvedValueOnce([
      makeReport("ready", TWO_HOURS_MS + 1000),
      makeReport("generating", TWO_HOURS_MS - 1000),
    ]);

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleaned).toBe(0);
    expect(body.total).toBe(2);
    expect(mockUpdateReport).not.toHaveBeenCalled();
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("marks stale generating reports as error", async () => {
    const stale = makeReport("generating", TWO_HOURS_MS + 5000, "report_stale");
    mockListReports.mockResolvedValueOnce([stale]);
    mockUpdateReport.mockResolvedValueOnce({ ...stale, status: "error" });

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    expect(mockUpdateReport).toHaveBeenCalledWith("report_stale", {
      status: "error",
    });
    const body = await res.json();
    expect(body.cleaned).toBe(1);
  });

  it("sends Slack notification when reports are cleaned", async () => {
    const stale = makeReport("generating", TWO_HOURS_MS + 10000);
    mockListReports.mockResolvedValueOnce([stale]);
    mockUpdateReport.mockResolvedValueOnce({ ...stale, status: "error" });

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    await GET(makeRequest(CRON_SECRET));

    expect(mockSlackPost).toHaveBeenCalledOnce();
    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.text).toContain("1");
  });

  it("cleans multiple stale reports", async () => {
    const stale1 = makeReport("generating", TWO_HOURS_MS + 1000, "report_a");
    const stale2 = makeReport("generating", TWO_HOURS_MS + 2000, "report_b");
    const fresh = makeReport("generating", TWO_HOURS_MS - 1000, "report_c");
    mockListReports.mockResolvedValueOnce([stale1, stale2, fresh]);
    mockUpdateReport.mockResolvedValue({ status: "error" });

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(mockUpdateReport).toHaveBeenCalledTimes(2);
    expect(body.cleaned).toBe(2);
    expect(body.total).toBe(3);
  });

  it("does not touch reports with status ready or error", async () => {
    mockListReports.mockResolvedValueOnce([
      makeReport("ready", TWO_HOURS_MS + 1000, "r1"),
      makeReport("error", TWO_HOURS_MS + 1000, "r2"),
    ]);

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(mockUpdateReport).not.toHaveBeenCalled();
    expect(body.cleaned).toBe(0);
  });

  it("returns correct total count", async () => {
    mockListReports.mockResolvedValueOnce([
      makeReport("ready", 1000, "r1"),
      makeReport("ready", 1000, "r2"),
      makeReport("ready", 1000, "r3"),
    ]);

    const { GET } = await import("@/app/api/cron/report-cleanup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.total).toBe(3);
  });
});

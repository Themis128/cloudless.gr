import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSlackPost } = vi.hoisted(() => ({
  mockSlackPost: vi.fn(),
}));

const mockGetWeeklyAnalyticsRollup = vi.fn();

vi.mock("@/lib/analytics-events-d1", () => ({
  getWeeklyAnalyticsRollup: (...args: unknown[]) => mockGetWeeklyAnalyticsRollup(...args),
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn(function (this: { post: unknown }) {
    this.post = mockSlackPost;
  }),
}));

const CRON_SECRET = "test-cron-secret-xyz";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/cron/analytics-rollup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/analytics-rollup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    mockSlackPost.mockResolvedValue(true);
    mockGetWeeklyAnalyticsRollup.mockResolvedValue({
      bound: true,
      eventCount: 42,
      byType: { page_view: 30, contact_submit: 12 },
    });
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mockGetWeeklyAnalyticsRollup).not.toHaveBeenCalled();
  });

  it("returns 401 when secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest("bad-secret"));

    expect(res.status).toBe(401);
    expect(mockGetWeeklyAnalyticsRollup).not.toHaveBeenCalled();
  });

  it("summarizes D1 events then sends Slack notification", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    expect(mockGetWeeklyAnalyticsRollup).toHaveBeenCalledWith(7);
    expect(mockSlackPost).toHaveBeenCalledOnce();
  });

  it("returns event counts in the response body", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.bound).toBe(true);
    expect(body.eventCount).toBe(42);
    expect(body.byType.page_view).toBe(30);
  });

  it("still posts Slack when AUTH_DB is unbound", async () => {
    mockGetWeeklyAnalyticsRollup.mockResolvedValueOnce({
      bound: false,
      eventCount: 0,
      byType: {},
    });

    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.bound).toBe(false);
    expect(mockSlackPost).toHaveBeenCalledOnce();
    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.blocks.find((b: { type: string }) => b.type === "section").text.text).toContain(
      "unbound"
    );
  });

  it("Slack message includes the D1 event count", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.text).toContain("42");
  });
});

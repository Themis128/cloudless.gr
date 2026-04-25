import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSlackPost } = vi.hoisted(() => ({
  mockSlackPost: vi.fn(),
}));

const mockCreateWeeklyRollup = vi.fn();
const mockArchiveOldEvents = vi.fn();

vi.mock("@/lib/notion-analytics", () => ({
  createWeeklyRollup: () => mockCreateWeeklyRollup(),
  archiveOldEvents: (...args: unknown[]) => mockArchiveOldEvents(...args),
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
    mockCreateWeeklyRollup.mockResolvedValue("rollup-page-id-123");
    mockArchiveOldEvents.mockResolvedValue({ archived: 42, errors: 0 });
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mockCreateWeeklyRollup).not.toHaveBeenCalled();
    expect(mockArchiveOldEvents).not.toHaveBeenCalled();
  });

  it("returns 401 when secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest("bad-secret"));

    expect(res.status).toBe(401);
    expect(mockCreateWeeklyRollup).not.toHaveBeenCalled();
  });

  it("runs rollup and archive then sends Slack notification", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    expect(mockCreateWeeklyRollup).toHaveBeenCalledOnce();
    expect(mockArchiveOldEvents).toHaveBeenCalledWith(30);
    expect(mockSlackPost).toHaveBeenCalledOnce();
  });

  it("returns rollupId and archive counts in response body", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.rollupId).toBe("rollup-page-id-123");
    expect(body.archived).toBe(42);
    expect(body.errors).toBe(0);
  });

  it("returns null rollupId when Notion is not configured", async () => {
    mockCreateWeeklyRollup.mockResolvedValueOnce(null);
    mockArchiveOldEvents.mockResolvedValueOnce({ archived: 0, errors: 0 });

    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    expect(body.rollupId).toBeNull();
    expect(mockSlackPost).toHaveBeenCalledOnce();
  });

  it("includes error count in Slack message when archive has errors", async () => {
    mockArchiveOldEvents.mockResolvedValueOnce({ archived: 10, errors: 3 });

    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    const section = payload.blocks.find(
      (b: { type: string }) => b.type === "section",
    );
    expect(section.text.text).toContain("Errors:");
    expect(section.text.text).toContain("3");
  });

  it("does not include errors line when archive has no errors", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    const section = payload.blocks.find(
      (b: { type: string }) => b.type === "section",
    );
    expect(section.text.text).not.toContain("Errors:");
  });

  it("Slack message includes archived count", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.text).toContain("42");
  });

  it("runs rollup and archive in parallel (both always called)", async () => {
    const { GET } = await import("@/app/api/cron/analytics-rollup/route");
    await GET(makeRequest(CRON_SECRET));

    expect(mockCreateWeeklyRollup).toHaveBeenCalledOnce();
    expect(mockArchiveOldEvents).toHaveBeenCalledOnce();
  });
});

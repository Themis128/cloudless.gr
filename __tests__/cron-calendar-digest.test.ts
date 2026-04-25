import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSlackPost } = vi.hoisted(() => ({
  mockSlackPost: vi.fn(),
}));

const mockGetCalendarItems = vi.fn();

vi.mock("@/lib/content-calendar", () => ({
  getCalendarItems: (...args: unknown[]) => mockGetCalendarItems(...args),
  PLATFORM_LABELS: {
    meta: "Meta",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    x: "X",
    google: "Google Ads",
    activecampaign: "Email",
    notion: "Blog",
    google_calendar: "Calendar",
  },
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn(function (this: { post: unknown }) {
    this.post = mockSlackPost;
  }),
}));

const CRON_SECRET = "test-cron-secret-abc";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/cron/calendar-digest", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "cal_1",
    title: "Weekly Meta Post",
    type: "social_post",
    platform: "meta",
    date: "2026-05-10",
    status: "scheduled",
    ...overrides,
  };
}

describe("GET /api/cron/calendar-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    mockSlackPost.mockResolvedValue(true);
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mockGetCalendarItems).not.toHaveBeenCalled();
  });

  it("returns 401 when secret is wrong", async () => {
    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    const res = await GET(makeRequest("wrong-secret"));

    expect(res.status).toBe(401);
    expect(mockGetCalendarItems).not.toHaveBeenCalled();
  });

  it("returns no-items response when calendar is empty today", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.message).toMatch(/no items/i);
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("sends Slack digest and returns count when items exist", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([
      makeItem(),
      makeItem({ id: "cal_2", title: "LinkedIn Article", platform: "linkedin", status: "draft" }),
    ]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    const res = await GET(makeRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.message).toBe("Digest sent");

    expect(mockSlackPost).toHaveBeenCalledOnce();
    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.text).toContain("2 item(s)");
    expect(payload.blocks).toBeDefined();
  });

  it("includes the correct date in getCalendarItems call", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    await GET(makeRequest(CRON_SECRET));

    const today = new Date().toISOString().slice(0, 10);
    expect(mockGetCalendarItems).toHaveBeenCalledWith(today, today);
  });

  it("includes item title and platform in Slack blocks", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([makeItem()]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    const section = payload.blocks.find(
      (b: { type: string }) => b.type === "section",
    );
    expect(section.text.text).toContain("Weekly Meta Post");
    expect(section.text.text).toContain("Meta");
  });

  it("includes URL in Slack line when item has url", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([
      makeItem({ url: "https://facebook.com/post/123" }),
    ]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    await GET(makeRequest(CRON_SECRET));

    const payload = mockSlackPost.mock.calls[0][0];
    const section = payload.blocks.find(
      (b: { type: string }) => b.type === "section",
    );
    expect(section.text.text).toContain("https://facebook.com/post/123");
  });

  it("returns date in response body", async () => {
    mockGetCalendarItems.mockResolvedValueOnce([makeItem()]);

    const { GET } = await import("@/app/api/cron/calendar-digest/route");
    const res = await GET(makeRequest(CRON_SECRET));
    const body = await res.json();

    const today = new Date().toISOString().slice(0, 10);
    expect(body.date).toBe(today);
  });
});

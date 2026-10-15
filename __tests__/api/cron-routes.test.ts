/**
 * Tests for GET /api/cron/postiz-sync and GET /api/cron/email-digest.
 *
 * Both routes are guarded by cron auth then drive mocked libs — the tests
 * assert the reconcile/digest logic against the real route code.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const hoisted = vi.hoisted(() => ({
  cronOk: true,
  postizConfigured: true,
}));

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: vi.fn(async () => hoisted.cronOk),
  cronUnauthorized: vi.fn(
    () => NextResponse.json({ error: "unauthorized" }, { status: 401 })
  ),
}));

const calendar = vi.hoisted(() => ({
  getCalendarItems: vi.fn(),
  updateCalendarItem: vi.fn(),
}));
vi.mock("@/lib/content-calendar", () => calendar);

const postiz = vi.hoisted(() => ({
  isPostizConfigured: vi.fn(),
  listPosts: vi.fn(),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return {
    ...actual,
    isPostizConfigured: postiz.isPostizConfigured,
    listPosts: postiz.listPosts,
  };
});

const slack = vi.hoisted(() => ({
  notifyPostErrored: vi.fn(),
  notifyPostPublished: vi.fn(),
}));
vi.mock("@/lib/postiz-slack", () => slack);

const datalake = vi.hoisted(() => ({ getInsight: vi.fn() }));
vi.mock("@/lib/datalake-serve", () => datalake);

const emailLib = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  SENDERS: { admin: "admin@cloudless.gr" },
}));
vi.mock("@/lib/email", () => emailLib);

import { GET as postizSync } from "@/app/api/cron/postiz-sync/route";
import { GET as emailDigest } from "@/app/api/cron/email-digest/route";

function req(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: "Bearer cron-secret" },
  });
}

const SYNC = "http://localhost/api/cron/postiz-sync";
const DIGEST = "http://localhost/api/cron/email-digest";

describe("GET /api/cron/postiz-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.cronOk = true;
    hoisted.postizConfigured = true;
    postiz.isPostizConfigured.mockResolvedValue(true);
    postiz.listPosts.mockResolvedValue([]);
    calendar.getCalendarItems.mockResolvedValue([]);
    calendar.updateCalendarItem.mockResolvedValue(undefined);
    slack.notifyPostErrored.mockResolvedValue(undefined);
    slack.notifyPostPublished.mockResolvedValue(undefined);
  });

  it("401s when unauthorized", async () => {
    hoisted.cronOk = false;
    expect((await postizSync(req(SYNC))).status).toBe(401);
  });

  it("503s when Postiz is not configured", async () => {
    postiz.isPostizConfigured.mockResolvedValue(false);
    const res = await postizSync(req(SYNC));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("postiz_not_configured");
  });

  it("502s when listPosts fails", async () => {
    postiz.listPosts.mockRejectedValue(new Error("upstream down"));
    const res = await postizSync(req(SYNC));
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toBe("postiz_upstream_failed");
  });

  it("reconciles: missing/unchanged/published/error counts", async () => {
    postiz.listPosts.mockResolvedValue([
      { id: "p1", state: "PUBLISHED" },
      { id: "p2", state: "ERROR" },
      { id: "p3", state: "QUEUE" },
    ]);
    calendar.getCalendarItems.mockResolvedValue([
      { id: "i1", status: "scheduled", postizPostIds: ["p1"] }, // → published+notify
      { id: "i2", status: "scheduled", postizPostIds: ["p2"] }, // → draft+notify
      { id: "i3", status: "scheduled", postizPostIds: ["p3"] }, // unchanged
      { id: "i4", status: "scheduled", postizPostIds: ["px"] }, // missing
      { id: "i5", status: "draft", postizPostIds: [] }, // not a candidate
      { id: "i6", status: "draft" }, // not a candidate
    ]);

    const j = await (await postizSync(req(SYNC))).json();
    expect(j.ok).toBe(true);
    expect(j.candidates).toBe(4);
    expect(j.updated).toBe(2);
    expect(j.published).toBe(1);
    expect(j.errored).toBe(1);
    expect(j.unchanged).toBe(1);
    expect(j.missing).toBe(1);
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("i1", { status: "published" });
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("i2", { status: "draft" });
    expect(slack.notifyPostPublished).toHaveBeenCalledTimes(1);
    expect(slack.notifyPostErrored).toHaveBeenCalledTimes(1);
  });

  it("maps DRAFT state and ignores items without postizPostIds", async () => {
    postiz.listPosts.mockResolvedValue([{ id: "p9", state: "DRAFT" }]);
    calendar.getCalendarItems.mockResolvedValue([
      { id: "i1", status: "scheduled", postizPostIds: ["p9"] },
    ]);
    const j = await (await postizSync(req(SYNC))).json();
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("i1", { status: "draft" });
    expect(j.updated).toBe(1);
  });

  it("swallows Slack notify failures", async () => {
    postiz.listPosts.mockResolvedValue([{ id: "p1", state: "PUBLISHED" }]);
    calendar.getCalendarItems.mockResolvedValue([
      { id: "i1", status: "scheduled", postizPostIds: ["p1"] },
    ]);
    slack.notifyPostPublished.mockRejectedValue(new Error("slack dead"));
    const res = await postizSync(req(SYNC));
    expect(res.status).toBe(200);
  });

  it("swallows notifyPostErrored failures on ERROR posts", async () => {
    postiz.listPosts.mockResolvedValue([{ id: "p2", state: "ERROR" }]);
    calendar.getCalendarItems.mockResolvedValue([
      { id: "i2", status: "scheduled", postizPostIds: ["p2"] },
    ]);
    slack.notifyPostErrored.mockRejectedValue(new Error("slack dead"));
    const res = await postizSync(req(SYNC));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/cron/email-digest", () => {
  const insight = (over: Record<string, unknown> = {}) => ({
    summary: "exec summary text",
    bullets: ["bullet one", "bullet two"],
    metrics_cited: [],
    freshness: "2026-01-01T00:00:00Z",
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.cronOk = true;
    datalake.getInsight.mockResolvedValue(insight());
    emailLib.sendEmail.mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr";
  });

  it("401s when unauthorized", async () => {
    hoisted.cronOk = false;
    expect((await emailDigest(req(DIGEST))).status).toBe(401);
  });

  it("sends the digest to all recipients incl. owner", async () => {
    vi.stubEnv("DIGEST_RECIPIENT_EMAIL", "a@b.c, d@e.f");
    const res = await emailDigest(req(DIGEST));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.recipients).toContain("a@b.c");
    expect(j.recipients).toContain("d@e.f");
    expect(j.recipients).toContain("tbaltzakis@cloudless.gr");
    expect(emailLib.sendEmail).toHaveBeenCalledTimes(3);
    expect(emailLib.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Weekly Digest") })
    );
  });

  it("renders verified figures from cited metrics", async () => {
    datalake.getInsight.mockImplementation(async (domain: string) =>
      domain === "executive"
        ? insight({
            metrics_cited: [
              { key: "stripe_revenue.metric", value: "mrr" },
              { key: "stripe_revenue.value", value: "MRR" },
              { key: "stripe_revenue.amount_eur", value: 42 },
              { key: "linkedin_ads.spend_eur", value: 7 },
              { key: "linkedin_ads.ad_set_name", value: "Boost" },
              { key: "linkedin_ads.impressions", value: 100 },
              { key: "linkedin_ads.clicks", value: 3 },
              { key: "ads_funnel.count", value: 5 },
              { key: "ads_funnel.stage", value: "lead" },
              { key: "ads_funnel.cost_eur", value: 1.5 },
              { key: "social_leads.leads", value: 9 },
              { key: "social_leads.espocrm_synced", value: 9 },
              { key: 42, value: "not-a-string-key" },
            ],
          })
        : insight()
    );
    const res = await emailDigest(req(DIGEST));
    expect(res.status).toBe(200);
    const htmlArg = vi.mocked(emailLib.sendEmail).mock.calls[0][0] as {
      html: string;
      text: string;
    };
    expect(htmlArg.html).toContain("Verified figures");
    expect(htmlArg.html).toContain("revenue: €42");
    expect(htmlArg.html).toContain("Boost");
    expect(htmlArg.html).toContain("Ads funnel lead: 5");
    expect(htmlArg.html).toContain("Website leads: 9");
    expect(htmlArg.text).toContain("VERIFIED FIGURES");
    expect(htmlArg.html).toContain("Data as of");
  });

  it("handles all insights missing (catch → null)", async () => {
    datalake.getInsight.mockRejectedValue(new Error("datalake down"));
    const res = await emailDigest(req(DIGEST));
    expect(res.status).toBe(200);
    const htmlArg = vi.mocked(emailLib.sendEmail).mock.calls[0][0] as { html: string };
    expect(htmlArg.html).toContain("No executive insight available");
  });

  it("500s when sendEmail throws", async () => {
    emailLib.sendEmail.mockRejectedValue(new Error("smtp dead"));
    const res = await emailDigest(req(DIGEST));
    expect(res.status).toBe(500);
  });
});

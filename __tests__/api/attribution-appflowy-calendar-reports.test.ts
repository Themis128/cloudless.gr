/**
 * Tests for /api/admin/analytics/social-attribution,
 * /api/admin/appflowy/{case-studies,services,testimonials},
 * /api/admin/calendar/[id]/publish, /api/admin/reports/[id]/pdf.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const authD1 = vi.hoisted(() => ({ getAuthDbFromEnv: vi.fn() }));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return { ...actual, getAuthDbFromEnv: authD1.getAuthDbFromEnv };
});

const appflowyLists = vi.hoisted(() => ({
  getCaseStudies: vi.fn(),
  getServices: vi.fn(),
  getAllTestimonialsAdmin: vi.fn(),
  isAppFlowyConfigured: vi.fn(async () => true),
}));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy")>();
  return { ...actual, isAppFlowyConfigured: appflowyLists.isAppFlowyConfigured };
});
vi.mock("@/lib/appflowy-case-studies", () => ({
  getCaseStudies: appflowyLists.getCaseStudies,
}));
vi.mock("@/lib/appflowy-services", () => ({
  getServices: appflowyLists.getServices,
}));
vi.mock("@/lib/appflowy-testimonials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy-testimonials")>();
  return { ...actual, getAllTestimonialsAdmin: appflowyLists.getAllTestimonialsAdmin };
});

const calendar = vi.hoisted(() => ({
  getCalendarItems: vi.fn(),
  updateCalendarItem: vi.fn(),
}));
vi.mock("@/lib/content-calendar", () => calendar);

const postiz = vi.hoisted(() => ({
  isPostizConfigured: vi.fn(),
  listPostizIntegrations: vi.fn(),
  matchIntegrationsForPlatform: vi.fn(),
  schedulePost: vi.fn(),
  withSocialUtm: vi.fn((url: string, src: string, camp: string) => `${url}?utm=${src}|${camp}`),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return { ...actual, ...postiz };
});

const reports = vi.hoisted(() => ({ getReport: vi.fn() }));
vi.mock("@/lib/reports", () => reports);

import { GET as attrGet } from "@/app/api/admin/analytics/social-attribution/route";
import { GET as csGet } from "@/app/api/admin/appflowy/case-studies/route";
import { GET as svcGet } from "@/app/api/admin/appflowy/services/route";
import { GET as tstGet } from "@/app/api/admin/appflowy/testimonials/route";
import { POST as calPublish } from "@/app/api/admin/calendar/[id]/publish/route";
import { GET as pdfGet } from "@/app/api/admin/reports/[id]/pdf/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("social-attribution", () => {
  const dbRows = (rows: unknown[]) => ({
    prepare: () => ({
      bind: () => ({ all: async () => ({ results: rows }) }),
    }),
  });

  it("503 without db; aggregates rows + totals + conversion rate", async () => {
    authD1.getAuthDbFromEnv.mockReturnValue(null);
    expect(
      (
        await attrGet(
          new NextRequest("http://x/api/admin/analytics/social-attribution")
        )
      ).status
    ).toBe(503);

    authD1.getAuthDbFromEnv.mockReturnValue(
      dbRows([
        { utm_source: "x", sessions: 10, signups: 2, leads: 3, purchases: 1, revenue: 99 },
        { utm_source: "li", sessions: 5, signups: 0, leads: 1, purchases: 0, revenue: 0 },
      ])
    );
    const j = await (
      await attrGet(
        new NextRequest("http://x/api/admin/analytics/social-attribution?days=30")
      )
    ).json();
    expect(j.days).toBe(30);
    expect(j.rows).toHaveLength(2);
    expect(j.totals).toMatchObject({
      sessions: 15,
      signups: 2,
      leads: 4,
      revenue: 99,
    });
    expect(j.totals.conversionRate).toBeCloseTo(40);

    // days clamp at 365
    const j2 = await (
      await attrGet(
        new NextRequest("http://x/api/admin/analytics/social-attribution?days=9999")
      )
    ).json();
    expect(j2.days).toBe(365);
  });
});

describe("appflowy thin routes (shared handler factory)", () => {
  it("case-studies/services/testimonials GET via factory", async () => {
    appflowyLists.getCaseStudies.mockResolvedValue([{ id: "c1" }]);
    const j = await (
      await csGet(new NextRequest("http://x/api/admin/appflowy/case-studies"))
    ).json();
    expect(j.caseStudies).toHaveLength(1);

    appflowyLists.getServices.mockResolvedValue([{ id: "s1" }]);
    const j2 = await (
      await svcGet(new NextRequest("http://x/api/admin/appflowy/services"))
    ).json();
    expect(j2.services).toHaveLength(1);

    appflowyLists.getAllTestimonialsAdmin.mockResolvedValue([{ id: "t1" }]);
    const j3 = await (
      await tstGet(new NextRequest("http://x/api/admin/appflowy/testimonials"))
    ).json();
    expect(j3.testimonials).toHaveLength(1);

    apiAuth.ok = false;
    expect(
      (await csGet(new NextRequest("http://x/api/admin/appflowy/case-studies")))
        .status
    ).toBe(401);
  });
});

describe("calendar publish", () => {
  const req = (id: string, body?: unknown) =>
    calPublish(
      new NextRequest(`http://x/api/admin/calendar/${id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? "not-json" : JSON.stringify(body),
      }),
      params(id)
    );

  const item = (over: Record<string, unknown> = {}) => ({
    id: "cal-1",
    type: "social_post",
    platform: "linkedin",
    title: "T",
    notes: "notes https://cloudless.gr",
    date: new Date(Date.now() + 86400000).toISOString(),
    ...over,
  });

  it("full publish ladder: 503/404/400/409/502/success paths", async () => {
    postiz.isPostizConfigured.mockResolvedValue(false);
    expect((await req("cal-1")).status).toBe(503);

    postiz.isPostizConfigured.mockResolvedValue(true);
    calendar.getCalendarItems.mockResolvedValue([]);
    expect((await req("missing")).status).toBe(404);

    calendar.getCalendarItems.mockResolvedValue([item({ type: "blog_post" })]);
    const j = await (await req("cal-1")).json();
    expect(j.error).toContain("social_post");

    calendar.getCalendarItems.mockResolvedValue([
      item({ notes: "", title: "" }),
    ]);
    const j2 = await (await req("cal-1", { content: "" })).json();
    expect(j2.error).toContain("No content");

    calendar.getCalendarItems.mockResolvedValue([item()]);
    postiz.listPostizIntegrations.mockResolvedValue([]);
    postiz.matchIntegrationsForPlatform.mockReturnValue([]);
    expect((await req("cal-1")).status).toBe(409);

    postiz.matchIntegrationsForPlatform.mockReturnValue([
      { id: "i1", name: "LI", identifier: "@li" },
    ]);
    postiz.schedulePost.mockResolvedValue({ ok: false, error: "postiz down" });
    expect((await req("cal-1")).status).toBe(502);

    postiz.schedulePost.mockResolvedValue({ ok: true, postIds: ["p1"] });
    calendar.updateCalendarItem.mockResolvedValue({ id: "cal-1", status: "scheduled" });
    const j3 = await (await req("cal-1", { asDraft: true })).json();
    expect(j3.success).toBe(true);
    expect(j3.channels).toEqual([{ id: "i1", name: "LI", identifier: "@li" }]);
    expect(postiz.schedulePost).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("utm=linkedin|calendar_cal-1"),
        integrationIds: ["i1"],
        asDraft: true,
      })
    );
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("cal-1", {
      status: "draft",
      postizPostIds: ["p1"],
    });
  });

  it("schedules future items, publishes past, merges existing postiz ids", async () => {
    postiz.isPostizConfigured.mockResolvedValue(true);
    postiz.matchIntegrationsForPlatform.mockReturnValue([{ id: "i1" }]);
    postiz.schedulePost.mockResolvedValue({ ok: true, postIds: ["p2"] });
    calendar.updateCalendarItem.mockResolvedValue({});

    calendar.getCalendarItems.mockResolvedValue([
      item({ postizPostIds: ["p1"] }),
    ]);
    await req("cal-1");
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("cal-1", {
      status: "scheduled",
      postizPostIds: ["p1", "p2"],
    });

    calendar.getCalendarItems.mockResolvedValue([
      item({ date: "2020-01-01T00:00:00Z" }),
    ]);
    await req("cal-1");
    expect(calendar.updateCalendarItem).toHaveBeenLastCalledWith("cal-1", {
      status: "published",
      postizPostIds: ["p2"],
    });
  });
});

describe("reports pdf", () => {
  it("404s missing; renders escaped HTML sections", async () => {
    reports.getReport.mockResolvedValue(null);
    expect(
      (await pdfGet(new NextRequest("http://x/api/admin/reports/r1/pdf"), params("r1")))
        .status
    ).toBe(404);

    reports.getReport.mockResolvedValue({
      clientName: "Acme <script>",
      status: "final",
      createdAt: "2026-01-15T00:00:00Z",
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
      sections: [
        {
          title: "Traffic",
          data: { page_views: 1234, note: null, meta: { a: 1 } },
          insights: "good <b>",
        },
      ],
    });
    const res = await pdfGet(
      new NextRequest("http://x/api/admin/reports/r1/pdf"),
      params("r1")
    );
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Acme &lt;script&gt;");
    expect(html).toContain("1,234");
    expect(html).toContain("N/A");
    expect(html).toContain('"a": 1');
    expect(html).toContain("good &lt;b&gt;");
    expect(res.headers.get("Content-Disposition")).toBe(
      'inline; filename="report-r1.html"'
    );
  });
});

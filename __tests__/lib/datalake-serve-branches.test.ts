/**
 * datalake-serve.ts branch batch — the fallback arms for alternate gold
 * column names (avg_position/position, amount_eur/revenue/amount,
 * count/orders/events, day/date/period, spend/cost, leads/conversions),
 * missing sections, section errors and malformed indexes. Gold parquet
 * schemas have drifted over time, so every alias must keep feeding the
 * admin cards. The R2 dashboard + bucket are faked; the real
 * gsc-dimension-gold mapper runs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDashboard, mockLoadSnapshot, mockGetBucket } = vi.hoisted(() => ({
  mockGetDashboard: vi.fn(),
  mockLoadSnapshot: vi.fn(),
  mockGetBucket: vi.fn(),
}));

vi.mock("@/lib/datalake-r2", () => ({
  getDatalakeDashboard: mockGetDashboard,
  loadDatalakeSnapshotFromR2: mockLoadSnapshot,
}));
vi.mock("@/lib/r2-client", () => ({ getDataLakeBucketFromEnv: mockGetBucket }));

import {
  getGscDimensionFromLake,
  getKpiFromLake,
  getRoiFromLake,
  getSeoFromLake,
  getStripeSnapshotFromLake,
  getUnifiedFromLake,
  listInsightDomains,
  pipelineFromEspocrmGold,
} from "@/lib/datalake-serve";

type Row = Record<string, unknown>;
const section = (name: string, rows: Row[] = [], error?: string) => ({
  section: name,
  rows,
  rowCount: rows.length,
  error,
});
const dash = (...sections: ReturnType<typeof section>[]) =>
  mockGetDashboard.mockResolvedValue({ sections, generated_at: "g1", source: "r2", freshness: {} });

const isoDay = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  dash();
  mockLoadSnapshot.mockResolvedValue(null);
});

describe("listInsightDomains", () => {
  it("keeps the index timestamp when present, stamps now when blank or missing", async () => {
    const put = (body: unknown) =>
      mockGetBucket.mockReturnValue({
        get: vi.fn(async () => ({ text: async () => JSON.stringify(body) })),
      });

    put({ generated_at: "2026-10-01T00:00:00Z", domains: ["seo"] });
    expect(await listInsightDomains()).toEqual({
      generated_at: "2026-10-01T00:00:00Z",
      domains: ["seo"],
    });

    put({ generated_at: "", domains: [] });
    const blank = await listInsightDomains();
    expect(blank.domains).toEqual([]);
    expect(Date.parse(blank.generated_at)).not.toBeNaN();

    put({ domains: "not-an-array" });
    expect((await listInsightDomains()).domains).toEqual([]);
  });

  it("returns an empty index when R2 is unbound", async () => {
    mockGetBucket.mockReturnValue(null);
    expect((await listInsightDomains()).domains).toEqual([]);
  });
});

describe("getSeoFromLake", () => {
  it("zeroes everything when the section is missing", async () => {
    const seo = await getSeoFromLake(7);
    expect(seo.snapshot).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0, days: 7 });
    expect(seo.keywords).toEqual([]);
    expect(seo.error).toBeUndefined();
    expect(Date.parse(seo.fetchedAt)).not.toBeNaN();
  });

  it("falls back from avg_position to position and coerces junk to 0", async () => {
    dash(
      section("top_keywords", [
        { query: "a", clicks: 2, impressions: 10, ctr: 0.2, position: 4 },
        { query: null, clicks: "x", impressions: null, ctr: null },
      ])
    );
    mockLoadSnapshot.mockResolvedValue({ generated_at: "snap-1" });
    const seo = await getSeoFromLake();
    expect(seo.keywords).toEqual([
      { query: "a", clicks: 2, impressions: 10, ctr: 0.2, position: 4 },
      { query: "", clicks: 0, impressions: 0, ctr: 0, position: 0 },
    ]);
    expect(seo.snapshot).toMatchObject({ clicks: 2, impressions: 10, ctr: 0.2, position: 2 });
    expect(seo.fetchedAt).toBe("snap-1");
  });
});

describe("getGscDimensionFromLake", () => {
  it("surfaces the first section error only when no rows mapped", async () => {
    dash(section("top_pages", [], "parquet missing"), section("gsc_countries", [], "stale"));
    const empty = await getGscDimensionFromLake("page");
    expect(empty.rows).toEqual([]);
    expect(empty.error).toBe("parquet missing");

    dash(section("top_pages", [{ page: "/a", clicks: 1 }]), section("gsc_countries", [], "stale"));
    const ok = await getGscDimensionFromLake("page");
    expect(ok.rows).toHaveLength(1);
    expect(ok.error).toBeUndefined();
  });
});

describe("getUnifiedFromLake", () => {
  it("derives revenue/orders from the paid_orders metric, trying each column alias", async () => {
    dash(section("stripe_revenue", [{ metric: "paid_orders", revenue: "120.5", count: 3 }]));
    let u = await getUnifiedFromLake();
    expect(u.stripe).toMatchObject({ totalOrders: 3, revenue: 120.5 });

    dash(
      section("stripe_revenue", [{ metric: "paid_orders", amount: 40, value: null, count: null }])
    );
    u = await getUnifiedFromLake();
    expect(u.stripe).toMatchObject({ totalOrders: 0, revenue: 40 });
  });

  it("sums per-row amounts when there is no paid_orders row, and uses rowCount for orders", async () => {
    dash(
      section("stripe_revenue", [
        { amount_eur: 10 },
        { revenue: 5 },
        { amount: "2" },
        { amount: "junk" },
      ])
    );
    const u = await getUnifiedFromLake();
    expect(u.stripe).toMatchObject({ revenue: 17, totalOrders: 4 });
  });

  it("nulls the cards whose sections errored and lists them as missing", async () => {
    dash(
      section("stripe_revenue", [], "no parquet"),
      section("espocrm_funnel", [], "espo down"),
      section("attribution", [], "empty"),
      section("top_keywords", [], "gsc stale")
    );
    const u = await getUnifiedFromLake();
    expect(u.stripe).toBeNull();
    expect(u.pipeline).toBeNull();
    expect(u.attribution).toBeNull();
    expect(u.seo).toBeNull();
    expect(u.sectionsMissing).toEqual([
      "stripe_revenue",
      "espocrm_funnel",
      "attribution",
      "top_keywords",
    ]);
  });

  it("missing sections give empty-but-present cards", async () => {
    const u = await getUnifiedFromLake();
    expect(u.stripe).toMatchObject({ totalOrders: 0, revenue: 0, rows: [] });
    expect(u.pipeline).toEqual({ totalDeals: 0, totalValue: 0, byStage: {} });
    expect(u.attribution).toEqual([]);
  });
});

describe("pipelineFromEspocrmGold", () => {
  it("labels by lead_source → lifecycle_stage → (none) and counts contacts when no deals", () => {
    expect(
      pipelineFromEspocrmGold([
        { lifecycle_stage: "lead", contact_count: 4 },
        { contact_count: "x", closed_won_revenue: null },
      ])
    ).toEqual({
      totalDeals: 4,
      totalValue: 0,
      byStage: { lead: { count: 4, value: 0 }, "(none)": { count: 0, value: 0 } },
    });
  });
});

describe("getRoiFromLake", () => {
  it("windows LinkedIn rows by day/date, keeps undated rows, and uses cost/conversions aliases", async () => {
    dash(
      section("linkedin_ads", [
        { day: isoDay(1), spend: 10, impressions: 100, clicks: 5, leads: 1 },
        { date: isoDay(2), cost: "2.5", impressions: "50", clicks: null, conversions: 2 },
        { date: isoDay(400), spend: 999, impressions: 1, clicks: 1 },
        { spend: 1 }, // undated → kept
      ]),
      section("stripe_revenue", [{ metric: "paid_orders", amount_eur: 27 }])
    );
    const roi = (await getRoiFromLake(30)) as {
      channels: Array<Record<string, unknown>>;
      totals: Record<string, unknown>;
    };
    expect(roi.channels[0]).toMatchObject({
      channel: "linkedin",
      configured: true,
      status: "gold",
      spendCents: 1350,
      impressions: 150,
      clicks: 5,
      platformLeads: 3,
      reason: "Served from gold linkedin_ads (last 30d)",
    });
    expect(roi.totals).toMatchObject({ revenueCents: 2700, roas: 2 });
  });

  it("clamps the window and reports an empty-but-present LinkedIn section", async () => {
    dash(section("linkedin_ads", []), section("stripe_revenue", [{ amount: 5 }]));
    const roi = (await getRoiFromLake(0)) as Record<string, unknown> & {
      channels: Array<Record<string, unknown>>;
      totals: Record<string, unknown>;
    };
    expect(roi.windowDays).toBe(30);
    expect(roi.channels[0]).toMatchObject({
      status: "empty_gold",
      reason: "Gold section present but empty for window",
    });
    expect(roi.totals).toMatchObject({ revenueCents: 500, roas: null });
    expect((await getRoiFromLake(5000)).windowDays).toBe(365);
  });

  it("propagates section errors into reason, totals and notes", async () => {
    dash(section("linkedin_ads", [], "token expired"), section("stripe_revenue", [], "no parquet"));
    const roi = (await getRoiFromLake()) as {
      channels: Array<Record<string, unknown>>;
      totals: Record<string, unknown>;
      notes: string[];
    };
    expect(roi.channels[0].reason).toBe("linkedin_ads: token expired");
    expect(roi.totals.revenueCents).toBeNull();
    expect(roi.notes).toContain("linkedin_ads: token expired");
    expect(roi.notes).toContain("stripe_revenue: no parquet");
  });
});

describe("getKpiFromLake", () => {
  it("defaults rows to [] and collects errors when sections are missing or broken", async () => {
    dash(section("top_keywords", [], "gsc stale"));
    const kpi = await getKpiFromLake();
    expect(kpi).toMatchObject({ revenueRows: [], funnelRows: [], errors: ["gsc stale"] });
  });
});

describe("getStripeSnapshotFromLake", () => {
  it("maps day/date/period, revenue/amount and count/orders/events aliases; skips null categories", async () => {
    dash(
      section("stripe_revenue", [
        { day: "2026-10-01", revenue: 10, count: 2, category: "store" },
        { date: "2026-10-02", amount: "5.5", orders: 1, category: "store" },
        { period: "2026-W40", events: 3 },
        { amount: "junk" },
      ])
    );
    const s = await getStripeSnapshotFromLake(14);
    expect(s.dailyTrend.map((d) => [d.day, d.revenueMinor, d.events])).toEqual([
      ["2026-10-01", 1000, 2],
      ["2026-10-02", 550, 1],
      ["2026-W40", 0, 3],
      ["", 0, 0],
    ]);
    expect(s.totals).toEqual({ events: 6, revenueMinor: 1550, processed: 6, failed: 0 });
    // byCategory counts `count ?? events` (orders is not an alias there)
    expect(s.byCategory).toEqual({ store: { events: 2, revenueMinor: 1550 } });
    expect(s.windowDays).toBe(14);
  });

  it("returns an empty snapshot with the section error", async () => {
    dash(section("stripe_revenue", [], "no parquet"));
    const s = await getStripeSnapshotFromLake();
    expect(s.dailyTrend).toEqual([]);
    expect(s.error).toBe("no parquet");
  });
});

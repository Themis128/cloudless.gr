import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDashboard, mockLoadSnapshot, mockGetBucket, mockMapGold } =
  vi.hoisted(() => ({
    mockGetDashboard: vi.fn(),
    mockLoadSnapshot: vi.fn(),
    mockGetBucket: vi.fn(),
    mockMapGold: vi.fn(() => ({ rows: [{ q: "x" }], note: "mapped" })),
  }));

vi.mock("@/lib/datalake-r2", () => ({
  getDatalakeDashboard: mockGetDashboard,
  loadDatalakeSnapshotFromR2: mockLoadSnapshot,
}));
vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: mockGetBucket,
}));
vi.mock("@/lib/gsc-dimension-gold", () => ({
  mapGoldRowsForGscDimension: mockMapGold,
}));

import {
  getCtrOpportunitiesFromLake,
  getFreshness,
  getGoldDashboard,
  getGoldSection,
  getGscDimensionFromLake,
  getGscWeeklyGold,
  getInsight,
  getInsightsIndex,
  getKpiFromLake,
  getRoiFromLake,
  getSeoFromLake,
  getStripeSnapshotFromLake,
  getUnifiedFromLake,
  listInsightDomains,
} from "@/lib/datalake-serve";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboard.mockResolvedValue({ sections: [], generated_at: "g1", source: "s", freshness: {} });
});

const section = (name: string, rows: Record<string, unknown>[] = [], error?: string) => ({
  section: name, rows, rowCount: rows.length, error,
});

const dash = (sections: ReturnType<typeof section>[]) => {
  mockGetDashboard.mockResolvedValue({ sections, generated_at: "g1", source: "s", freshness: { f: 1 } });
};

describe("dashboard passthroughs", () => {
  it("getGoldSection finds by name; freshness + dashboard", async () => {
    dash([section("a", [{ x: 1 }]), section("b")]);
    expect((await getGoldSection("a"))?.rows).toEqual([{ x: 1 }]);
    expect(await getGoldSection("missing")).toBeNull();
    expect(await getFreshness()).toEqual({ f: 1 });
    expect((await getGoldDashboard()).generated_at).toBe("g1");
  });
});

describe("R2-backed reads", () => {
  it("no bucket → null; valid/invalid json", async () => {
    mockGetBucket.mockReturnValue(null);
    expect(await getGscWeeklyGold()).toBeNull();
    expect(await getInsight("seo")).toBeNull();

    mockGetBucket.mockReturnValue({
      get: vi.fn().mockResolvedValue({ text: async () => '{"a":1}' }),
    });
    expect(await getGscWeeklyGold()).toEqual({ a: 1 });
    expect(await getInsight("seo")).toEqual({ a: 1 });
    expect(await getInsightsIndex()).toEqual({ a: 1 });

    mockGetBucket.mockReturnValue({
      get: vi.fn()
        .mockResolvedValueOnce(null) // missing object
        .mockResolvedValueOnce({ text: async () => "not-json" }), // parse fail
    });
    expect(await getInsight("seo")).toBeNull();
    expect(await getInsightsIndex()).toBeNull();
  });

  it("listInsightDomains tolerates stub index", async () => {
    mockGetBucket.mockReturnValue({
      get: vi.fn().mockResolvedValue({ text: async () => '{"domains":["seo"],"generated_at":"g"}' }),
    });
    expect((await listInsightDomains()).domains).toEqual(["seo"]);
    mockGetBucket.mockReturnValue({
      get: vi.fn().mockResolvedValue({ text: async () => '{}' }),
    });
    expect((await listInsightDomains()).domains).toEqual([]);
  });
});

describe("getSeoFromLake + CTR opportunities", () => {
  it("maps top_keywords rows into snapshot+keywords", async () => {
    dash([section("top_keywords", [
      { query: "q1", clicks: 10, impressions: 100, ctr: 0.1, avg_position: 5 },
      { query: "q2", clicks: 20, impressions: 200, position: 8 },
    ])]);
    mockLoadSnapshot.mockResolvedValue({ generated_at: "snap1" });
    const out = await getSeoFromLake(28);
    expect(out.snapshot.clicks).toBe(30);
    expect(out.snapshot.impressions).toBe(300);
    expect(out.snapshot.ctr).toBeCloseTo(0.1);
    expect(out.keywords).toHaveLength(2);
    expect(out.fetchedAt).toBe("snap1");
  });

  it("CTR filter: pos 4-20, ctr<5%, imp>=20", async () => {
    dash([section("top_keywords", [
      { query: "keep", clicks: 1, impressions: 50, ctr: 0.02, position: 10 },
      { query: "low-imp", clicks: 1, impressions: 10, ctr: 0.02, position: 10 },
      { query: "high-ctr", clicks: 5, impressions: 50, ctr: 0.5, position: 10 },
      { query: "pos1", clicks: 1, impressions: 50, ctr: 0.02, position: 2 },
    ])]);
    const out = await getCtrOpportunitiesFromLake(10);
    expect(out.opportunities.map((o) => o.query)).toEqual(["keep"]);
  });
});

describe("getGscDimensionFromLake", () => {
  it("composes mapped rows + error precedence", async () => {
    dash([
      section("top_keywords", [{ query: "q", clicks: 1, impressions: 5 }]),
      section("top_pages", [{ page: "/a" }]),
    ]);
    const out = await getGscDimensionFromLake("pages", 28);
    expect(out.rows).toEqual([{ q: "x" }]);
    expect(out.note).toBe("mapped");
    expect(mockMapGold).toHaveBeenCalledWith("pages", expect.objectContaining({
      top_pages: [{ page: "/a" }],
    }));
  });

  it("empty mapped rows + section errors → error string", async () => {
    mockMapGold.mockReturnValueOnce({ rows: [], note: "n" });
    dash([
      section("top_pages", [], "pages fetch failed"),
      section("top_keywords"),
    ]);
    const out = await getGscDimensionFromLake("pages");
    expect(out.error).toBe("pages fetch failed");
  });
});

describe("getUnifiedFromLake", () => {
  it("composes seo + stripe + espocrm + attribution", async () => {
    dash([
      section("top_keywords", [{ query: "q", clicks: 5, impressions: 50 }]),
      section("stripe_revenue", [{ metric: "paid_orders", amount_eur: 42, count: 3 }]),
      section("espocrm_funnel", [{ lead_source: "organic", closed_won_deals: 2 }]),
      section("attribution", [{ src: "x" }]),
      section("broken", [], "etl failed"),
    ]);
    const out = await getUnifiedFromLake(28) as Record<string, any>;
    expect(out.stripe.revenue).toBe(42);
    expect(out.stripe.totalOrders).toBe(3);
    expect(out.pipeline.totalDeals).toBe(2);
    expect(out.attribution).toEqual([{ src: "x" }]);
    expect(out.sectionsMissing).toEqual(["broken"]);
  });

  it("stripe rows without paid_orders metric → sum all amounts", async () => {
    dash([
      section("top_keywords"),
      section("stripe_revenue", [{ amount_eur: 10 }, { amount: 5 }]),
      section("espocrm_funnel", [], "funnel err"),
    ]);
    const out = await getUnifiedFromLake() as Record<string, any>;
    expect(out.stripe.revenue).toBe(15);
    expect(out.pipeline).toBeNull(); // espocrm error → null
  });
});

describe("getRoiFromLake", () => {
  it("linkedin+stripe gold compose with roas + not_in_gold channels", async () => {
    const today = new Date().toISOString().slice(0, 10);
    dash([
      section("linkedin_ads", [{ day: today, spend: 100, impressions: 1000, clicks: 50, leads: 4 }]),
      section("stripe_revenue", [{ metric: "paid_orders", amount_eur: 500 }]),
    ]);
    const out = await getRoiFromLake(30) as Record<string, any>;
    const li = out.channels.find((c: { channel: string }) => c.channel === "linkedin");
    expect(li.configured).toBe(true);
    expect(li.status).toBe("gold");
    expect(out.channels.find((c: { channel: string }) => c.channel === "google").status)
      .toBe("not_in_gold");
    expect(out.totals.roas).toBe(5); // 50000c / 10000c
    expect(out.totals.spendCents).toBe(10000);
  });

  it("empty linkedin section → empty_gold, roas null, error notes", async () => {
    dash([
      section("linkedin_ads", [], "li etl broken"),
      section("stripe_revenue", [{ amount_eur: 7 }, { revenue: 3 }], "stripe err"),
    ]);
    const out = await getRoiFromLake(0) as Record<string, any>; // clamps to 30
    expect(out.windowDays).toBe(30);
    const li = out.channels.find((c: { channel: string }) => c.channel === "linkedin");
    expect(li.status).toBe("empty_gold");
    expect(out.totals.roas).toBeNull();
    expect(out.notes.join(" ")).toContain("li etl broken");
  });
});

describe("getKpiFromLake + getStripeSnapshotFromLake", () => {
  it("kpi composes seo+stripe+funnel with errors list", async () => {
    dash([
      section("top_keywords", [{ query: "q", clicks: 1, impressions: 9 }]),
      section("stripe_revenue", [{ a: 1 }]),
      section("acquisition_funnel", [{ stage: "s1" }]),
    ]);
    const out = await getKpiFromLake() as Record<string, any>;
    expect(out.revenueRows).toEqual([{ a: 1 }]);
    expect(out.funnelRows).toEqual([{ stage: "s1" }]);
    expect(out.errors).toEqual([]);
  });

  it("stripe snapshot aggregates rows + categories", async () => {
    dash([section("stripe_revenue", [
      { day: "2026-10-01", revenue: 10, count: 2, category: "plan" },
      { date: "2026-10-02", amount: 5, orders: 1, category: "plan" },
      { period: "2026-10-03", revenue: 1, events: 3 }, // no category → skipped
    ])]);
    const out = await getStripeSnapshotFromLake();
    expect(out.totals.revenueMinor).toBe(1600);
    expect(out.totals.events).toBe(6);
    expect(out.byCategory.plan.events).toBe(2); // orders not counted in byCategory
    expect(out.dailyTrend[0].day).toBe("2026-10-01");
  });
});

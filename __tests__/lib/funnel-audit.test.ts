/**
 * funnel-audit.ts — Tolstova stage report composed from EspoCRM stage
 * rows (real espocrm.ts over mocked fetch) + SocialAuto API responses
 * (mocked saFetch). Covers stage math, weakest-transition rule, proxy
 * exclusion, auction warning, and per-source degradation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetIntegrations, mockSaConfigured, mockSaFetch } = vi.hoisted(() => ({
  mockGetIntegrations: vi.fn(),
  mockSaConfigured: vi.fn(),
  mockSaFetch: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({ getIntegrationsAsync: mockGetIntegrations }));
vi.mock("@/lib/espocrm-cache", () => ({
  ESPO_CACHE_TTL: { list: 60, contact: 60, pipeline: 60 },
  invalidateEspoContactCaches: vi.fn(),
  invalidateEspoListCaches: vi.fn(),
  readThrough: async (_k: string, _p: unknown, fn: () => Promise<unknown>) => ({
    value: await fn(),
  }),
}));
vi.mock("@/lib/crm-contact-360-shared", () => ({
  isEspoRecordId: (v: unknown) => typeof v === "string" && v.length > 0 && !v.includes(" "),
}));
vi.mock("@/lib/socialauto", () => ({
  isSocialAutoConfigured: mockSaConfigured,
  saFetch: mockSaFetch,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const listResp = (list: unknown[]) => json({ list, total: list.length });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const LEADS = [
  { status: "New", source: "Web Site" },
  { status: "New", source: "LinkedIn" },
  { status: "In Process", source: "Web Site" },
  { status: "Dead", source: "Cold Call" },
];
const OPPS = [
  { stage: "Proposal/Price Quote" },
  { stage: "Negotiation/Review" },
  { stage: "Closed Won" },
  { stage: "Closed Lost" },
];

// reach series: point ~40d ago (baseline for the 30d-ago lookup) and a
// recent point — mirrors follower_snapshots change-log semantics.
function followersSeries(old: number, recent: number) {
  return [
    {
      platform: "linkedin",
      current: recent,
      series: [
        { date: daysAgo(40), followers: old },
        { date: daysAgo(5), followers: recent },
      ],
    },
  ];
}

function mockEspo(leads: unknown[] | "fail", opps: unknown[] | "fail") {
  mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("/Lead?")) {
      return leads === "fail" ? json({ error: "down" }, 500) : listResp(leads);
    }
    if (u.includes("/Opportunity?")) {
      return opps === "fail" ? json({ error: "down" }, 500) : listResp(opps);
    }
    return json({}, 404);
  });
}

function mockSa(overrides: { followers?: unknown; overview?: unknown; state?: unknown } = {}) {
  mockSaFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/analytics/followers")) {
      return json(overrides.followers ?? followersSeries(900, 1000));
    }
    if (path.startsWith("/analytics/overview")) {
      return json(
        overrides.overview ?? {
          total_followers: 1000,
          total_engagement: 42,
          connected_accounts: 3,
        }
      );
    }
    if (path === "/funnel/state") {
      return json(
        overrides.state ?? {
          leads: { hot: 2, warm: 1, cold: 5 },
          conversions: [{ campaign: "spring", count: 2, value: 400 }],
          total_conversions: 2,
          total_value: 400,
        }
      );
    }
    return json({}, 404);
  });
}

async function lib() {
  return await import("@/lib/funnel-audit");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockSaFetch.mockReset();
  vi.resetModules();
  mockGetIntegrations.mockResolvedValue({
    ESPOCRM_BASE_URL: "https://espo.example",
    ESPOCRM_API_KEY: "k",
  });
  mockSaConfigured.mockResolvedValue(true);
  mockEspo(LEADS, OPPS);
  mockSa();
});

describe("buildFunnelAudit — happy path", () => {
  it("computes Tolstova stages, conversions, weakest transition, sources", async () => {
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();

    expect(r.sources).toEqual({ espocrm: true, socialauto: true });
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(byStage.audience.count).toBe(1000);
    expect(byStage.audience.note).toContain("900");
    expect(byStage.engaged.count).toBe(42);
    expect(byStage.engaged.proxy).toBe(true);
    expect(byStage.lead.count).toBe(4);
    expect(byStage.lead.note).toContain("1 dead");
    expect(byStage.nurtured.count).toBe(1); // only "In Process" — New+Dead excluded
    expect(byStage.opportunity.count).toBe(4); // all stages incl. closed
    expect(byStage.won.count).toBe(1);

    // conv vs previous stage (proxy stages still display a number)
    expect(byStage.audience.conv_pct).toBeNull();
    expect(byStage.engaged.conv_pct).toBeCloseTo(4.2, 1); // 42/1000
    expect(byStage.lead.conv_pct).toBeCloseTo(9.52, 1); // 4/42
    expect(byStage.nurtured.conv_pct).toBe(25); // 1/4
    expect(byStage.opportunity.conv_pct).toBe(400); // 4/1
    expect(byStage.won.conv_pct).toBe(25); // 1/4 — win rate vs all opps

    // weakest non-proxy transition: engaged→lead excluded (prev is proxy),
    // candidates lead→nurtured 25%, nurtured→opp 400%, opp→won 25%
    expect(r.weakest_transition).toBe("lead→nurtured (25%)");
    expect(r.lead_sources).toEqual({ "Web Site": 2, LinkedIn: 1, "Cold Call": 1 });
    expect(r.socialauto_funnel?.total_conversions).toBe(2);
    expect(r.socialauto_funnel?.lead_tiers.hot).toBe(2);
  });

  it("flags the auction warning when reach grows and lead conv <0.5%", async () => {
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    // reach 900→1000 grew; 4 leads / 1000 followers = 0.4% < 0.5%
    expect(r.auction_warning).toBe(true);
  });

  it("does not warn when reach is flat or lead conversion is healthy", async () => {
    mockSa({ followers: followersSeries(1000, 1000) });
    const { buildFunnelAudit } = await lib();
    expect((await buildFunnelAudit()).auction_warning).toBe(false); // reach flat

    // healthy conversion: 10 leads / 100 followers = 10%
    mockEspo(
      Array.from({ length: 10 }, () => ({ status: "New", source: "Web Site" })),
      OPPS
    );
    mockSa({ followers: followersSeries(50, 100) });
    expect((await buildFunnelAudit()).auction_warning).toBe(false);
  });

  it("does not fire the auction warning when EspoCRM is unreachable", async () => {
    // Reach is growing (900→1000) but leads are unknown — null must not
    // be treated as 0 leads, or the warning would fire on reach alone.
    mockEspo("fail", "fail");
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    expect(r.auction_warning).toBe(false);
  });

  it("falls back to current followers for accounts with no snapshot series", async () => {
    // New account onboarded mid-window: series empty → current count used.
    mockSa({
      followers: [{ platform: "x", current: 500, series: [] }, ...followersSeries(900, 1000)],
    });
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    const audience = r.stages.find((s) => s.stage === "audience");
    expect(audience?.count).toBe(1500); // 500 (current) + 1000 (current)
  });
});

describe("buildFunnelAudit — degradation", () => {
  it("EspoCRM failure nulls CRM stages but keeps SocialAuto stages", async () => {
    mockEspo("fail", "fail");
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(r.sources.espocrm).toBe(false);
    expect(r.sources.socialauto).toBe(true);
    expect(byStage.audience.count).toBe(1000);
    expect(byStage.lead.count).toBeNull();
    expect(byStage.won.count).toBeNull();
    expect(r.weakest_transition).toBeNull();
  });

  it("SocialAuto unconfigured nulls audience/engaged", async () => {
    mockSaConfigured.mockResolvedValue(false);
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(r.sources.socialauto).toBe(false);
    expect(byStage.audience.count).toBeNull();
    expect(byStage.engaged.count).toBeNull();
    expect(byStage.lead.count).toBe(4);
    expect(r.socialauto_funnel).toBeNull();
    expect(mockSaFetch).not.toHaveBeenCalled();
  });

  it("partial EspoCRM failure marks the source unhealthy", async () => {
    // Leads OK, opportunities down → sources.espocrm must be false.
    mockEspo(LEADS, "fail");
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    expect(r.sources.espocrm).toBe(false);
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(byStage.lead.count).toBe(4);
    expect(byStage.opportunity.count).toBeNull();
  });

  it("partial SocialAuto failure marks the source unhealthy", async () => {
    // Overview + funnel/state OK, followers down → sources.socialauto false.
    mockSaFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/analytics/followers")) return json({ error: "down" }, 503);
      if (path.startsWith("/analytics/overview")) {
        return json({ total_followers: 1000, total_engagement: 42, connected_accounts: 3 });
      }
      if (path === "/funnel/state") return json({ leads: {}, conversions: [] });
      return json({}, 404);
    });
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    expect(r.sources.socialauto).toBe(false);
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(byStage.audience.count).toBeNull();
    expect(byStage.engaged.count).toBe(42);
  });

  it("SocialAuto fetch failures degrade per-endpoint", async () => {
    mockSaFetch.mockResolvedValue(json({ error: "down" }, 503));
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    const byStage = Object.fromEntries(r.stages.map((s) => [s.stage, s]));
    expect(r.sources.socialauto).toBe(false);
    expect(byStage.audience.count).toBeNull();
    expect(byStage.lead.count).toBe(4);
  });

  it("saFetch throwing is caught", async () => {
    mockSaFetch.mockRejectedValue(new Error("asleep"));
    const { buildFunnelAudit } = await lib();
    const r = await buildFunnelAudit();
    expect(r.sources.socialauto).toBe(false);
    expect(r.stages.find((s) => s.stage === "audience")?.count).toBeNull();
  });
});

describe("espocrm.getFunnelStageData", () => {
  it("returns null per entity on fetch failure", async () => {
    mockEspo("fail", OPPS);
    const { getFunnelStageData } = await import("@/lib/espocrm");
    const r = await getFunnelStageData();
    expect(r.leads).toBeNull();
    expect(r.opportunities).toHaveLength(4);
  });

  it("paginates beyond one page", async () => {
    const page1 = Array.from({ length: 100 }, () => ({ status: "New", source: "x" }));
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/Lead?")) {
        const offset = Number(new URL(u).searchParams.get("offset") ?? "0");
        return offset === 0 ? listResp(page1) : listResp([{ status: "New", source: "x" }]);
      }
      return listResp([]);
    });
    const { getFunnelStageData } = await import("@/lib/espocrm");
    const r = await getFunnelStageData();
    expect(r.leads).toHaveLength(101);
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const libs = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    LINKEDIN_ACCESS_TOKEN: "tok",
    LINKEDIN_AD_ACCOUNT_ID: "512",
  })),
  fetch: vi.fn(),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: libs.getConfig }));
vi.stubGlobal("fetch", libs.fetch);

import { linkedinAdapter } from "@/lib/ad-analytics/adapters/linkedin";

const ok = (body: unknown) => ({ ok: true, json: async () => body, status: 200 }) as Response;
const bad = (status = 500) =>
  ({ ok: false, status, text: async () => "err body" }) as Response;

/** Dispatch fake fetch by URL substring. */
function urlRouter(map: Array<[string, () => Promise<Response> | Response]>) {
  libs.fetch.mockImplementation((url: string) => {
    for (const [frag, fn] of map) if (url.includes(frag)) return Promise.resolve(fn());
    return Promise.resolve(ok({ elements: [] }));
  });
}

const since = new Date("2026-06-01T00:00:00Z");
const until = new Date("2026-06-01T01:00:00Z");

beforeEach(() => {
  libs.fetch.mockReset();
  libs.getConfig.mockResolvedValue({
    LINKEDIN_ACCESS_TOKEN: "tok",
    LINKEDIN_AD_ACCOUNT_ID: "512",
  } as never);
  delete process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
});
afterEach(() => delete process.env.LINKEDIN_CAPI_ACCESS_TOKEN);

describe("resolveConfig failure paths", () => {
  it("getConfig throw → adapter reports unconfigured, calls degrade", async () => {
    libs.getConfig.mockRejectedValue(new Error("ssm down"));
    expect(await linkedinAdapter.isConfigured()).toBe(false);
    expect(
      await linkedinAdapter.pullMetrics({ accountId: "a", campaignIds: ["c"], since, until })
    ).toEqual([]);
    expect(
      await linkedinAdapter.pullAccountSpendEur({ accountId: "a", since: "2026-01-01", until })
    ).toBeNull();
    const r = await linkedinAdapter.pushConversion({
      accountId: "a",
      conversionId: 1,
      eventId: "e",
      happenedAt: new Date(),
    });
    expect(r.status).toBe(204);
  });

  it("pullMetrics: empty campaignIds → [] without a fetch", async () => {
    expect(
      await linkedinAdapter.pullMetrics({ accountId: "a", campaignIds: [], since, until })
    ).toEqual([]);
    expect(libs.fetch).not.toHaveBeenCalled();
  });
});

describe("pullMetrics enrichment", () => {
  it("demographic pivots + creative leaderboard enrich the row", async () => {
    urlRouter([
      [
        "pivot=MEMBER_INDUSTRY",
        () => ok({ elements: [{ clicks: 8, pivotValues: ["urn:li:industry:4"] }] }),
      ],
      [
        "pivot=CREATIVE",
        () =>
          ok({
            elements: [
              { impressions: 100, clicks: 6, pivotValues: ["urn:li:sponsoredCreative:99"] },
            ],
          }),
      ],
      ["creatives?ids=", () => ok({ results: { "urn:li:sponsoredCreative:99": { name: "Hero" } } })],
      ["pivot=CAMPAIGN", () => ok({ elements: [{ impressions: 10, clicks: 2, costInLocalCurrency: "5.5", externalWebsiteConversions: 1 }] })],
    ]);
    const rows = await linkedinAdapter.pullMetrics({
      accountId: "a",
      campaignIds: ["c1"],
      since,
      until,
      pivots: ["MEMBER_INDUSTRY", "MEMBER_SENIORITY"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].impressions).toBe(10);
    expect(rows[0].ctr).toBeCloseTo(0.2);
    expect(rows[0].cpcEur).toBeCloseTo(2.75);
    expect(rows[0].cpaEur).toBeCloseTo(5.5);
    expect(rows[0].demographics?.MEMBER_INDUSTRY).toHaveLength(1);
    expect(rows[0].creativeLeaderboard![0]).toMatchObject({
      creativeId: "99",
      label: "Hero",
      ctr: 0.06,
    });
  });

  it("non-OK headline → zeroed row; pivot/creative errors tolerated", async () => {
    urlRouter([
      ["pivot=CAMPAIGN", () => bad(500)],
      ["pivot=MEMBER_INDUSTRY", () => bad(403)],
      ["pivot=CREATIVE", () => bad(429)],
    ]);
    const rows = await linkedinAdapter.pullMetrics({
      accountId: "a",
      campaignIds: ["c1"],
      since,
      until,
      pivots: ["MEMBER_INDUSTRY"],
    });
    expect(rows[0].impressions).toBe(0);
    expect(rows[0].demographics).toBeUndefined();
    expect(rows[0].creativeLeaderboard).toBeUndefined();
  });

  it("headline fetch throw → zeros; creative names fallback label", async () => {
    urlRouter([
      ["pivot=CAMPAIGN", () => Promise.reject(new Error("net"))],
      [
        "pivot=CREATIVE",
        () =>
          ok({
            elements: [
              { impressions: 50, clicks: 3, pivotValues: ["no-colon-urn"] },
            ],
          }),
      ],
      ["creatives?ids=", () => Promise.reject(new Error("names down"))],
    ]);
    const rows = await linkedinAdapter.pullMetrics({
      accountId: "a",
      campaignIds: ["c1"],
      since,
      until,
    });
    expect(rows[0].impressions).toBe(0);
    expect(rows[0].creativeLeaderboard![0].label).toBe("Creative no-colon-urn");
  });
});

describe("pullAccountSpendEur edges", () => {
  it("empty elements → 0; el without id skipped", async () => {
    urlRouter([["adCampaigns", () => ok({ elements: [] })]]);
    expect(
      await linkedinAdapter.pullAccountSpendEur({ accountId: "a", since: "2026-01-01", until })
    ).toBe(0);

    urlRouter([
      ["adCampaigns", () => ok({ elements: [{}, { id: "c9" }] })],
      ["pivot=CAMPAIGN", () => ok({ elements: [{ costInLocalCurrency: "4.25" }] })],
    ]);
    expect(
      await linkedinAdapter.pullAccountSpendEur({ accountId: "a", since: "2026-01-01", until })
    ).toBe(4.25);
  });
});

describe("pushConversion edges", () => {
  const base = {
    accountId: "a",
    conversionId: 42,
    eventId: "e1",
    happenedAt: new Date("2026-06-01"),
  };

  it("non-403 error returns status + sanitized message", async () => {
    libs.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server\x00error\nhere",
    });
    const r = await linkedinAdapter.pushConversion(base);
    expect(r.accepted).toBe(false);
    expect(r.status).toBe(500);
    expect(r.message).toBe("server error here");
  });

  it("fetch throw → status 0 with message", async () => {
    libs.fetch.mockRejectedValue(new Error("conn refused"));
    const r = await linkedinAdapter.pushConversion(base);
    expect(r).toEqual({ accepted: false, status: 0, message: "conn refused" });
  });

  it("buildUserIds maps every available field", async () => {
    libs.fetch.mockResolvedValue(ok({}));
    await linkedinAdapter.pushConversion({
      ...base,
      user: {
        emailSha256: "eh",
        phoneSha256: "ph",
        liFatId: "lf",
        ipAddress: "1.2.3.4",
      },
    });
    const body = JSON.parse(libs.fetch.mock.calls[0][1].body as string);
    expect(body.user.userIds).toEqual([
      { idType: "SHA256_EMAIL", idValue: "eh" },
      { idType: "SHA256_PHONE", idValue: "ph" },
      { idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: "lf" },
      { idType: "PLAINTEXT_IP_ADDRESS", idValue: "1.2.3.4" },
    ]);
  });
});

describe("fetchPivotBreakdown ordering", () => {
  it("filters zero-click rows, sorts desc, caps at 6, resolves labels", async () => {
    urlRouter([
      [
        "pivot=MEMBER_JOB_TITLE",
        () =>
          ok({
            elements: [
              { clicks: 0, pivotValues: ["urn:li:title:1"] },
              { clicks: 2, pivotValues: ["urn:li:title:2"] },
              { clicks: 9, pivotValues: ["urn:li:title:3"] },
              ...Array.from({ length: 7 }, (_, i) => ({
                clicks: 1,
                pivotValues: [`urn:li:title:${10 + i}`],
              })),
            ],
          }),
      ],
      ["pivot=CAMPAIGN", () => ok({ elements: [] })],
      ["pivot=CREATIVE", () => ok({ elements: [] })],
    ]);
    const rows = await linkedinAdapter.pullMetrics({
      accountId: "a",
      campaignIds: ["c"],
      since,
      until,
      pivots: ["MEMBER_JOB_TITLE"],
    });
    const bd = rows[0].demographics!.MEMBER_JOB_TITLE!;
    expect(bd).toHaveLength(6);
    expect(bd[0].clicks).toBe(9);
    expect(bd.every((r) => r.clicks > 0)).toBe(true);
  });
});

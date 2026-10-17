// @vitest-environment node
/**
 * LinkedIn ad-analytics adapter residual branches: token-only config,
 * missing `elements`/fields in every AdAnalytics response, unreadable error
 * bodies, non-Error failures, unnamed/unknown pivot rows, creatives without
 * URNs or impressions, name lookups that fail or return partial records, and
 * CAPI user-id mapping for partial matches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => ({ getConfig: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: libs.getConfig }));
vi.stubGlobal("fetch", libs.fetch);

import { linkedinAdapter } from "@/lib/ad-analytics/adapters/linkedin";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const unreadable = (status: number) =>
  ({ ok: false, status, text: () => Promise.reject(new Error("gone")) }) as unknown as Response;

type Handler = () => Response | Promise<Response>;
function router(map: Array<[string, Handler]>) {
  libs.fetch.mockImplementation(async (url: string) => {
    for (const [frag, fn] of map) if (url.includes(frag)) return fn();
    return ok({ elements: [] });
  });
}
const calledWith = (frag: string) =>
  libs.fetch.mock.calls.filter(([u]) => String(u).includes(frag));

const since = new Date("2026-06-01T00:00:00Z");
const until = new Date("2026-06-02T00:00:00Z");
const pull = (pivots: Parameters<typeof linkedinAdapter.pullMetrics>[0]["pivots"] = []) =>
  linkedinAdapter.pullMetrics({ accountId: "512", campaignIds: ["c1"], since, until, pivots });

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  libs.fetch.mockReset();
  libs.getConfig.mockResolvedValue({ LINKEDIN_ACCESS_TOKEN: "tok" });
  delete process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe("config", () => {
  it("a token without an ad account id is enough to be configured", async () => {
    expect(await linkedinAdapter.isConfigured()).toBe(true);
  });
});

describe("headline metrics", () => {
  it("missing elements give a zero row with no derived ratios", async () => {
    router([["pivot=CAMPAIGN", () => ok({})]]);
    const [row] = await pull();
    expect(row).toMatchObject({ impressions: 0, clicks: 0, conversions: 0, spendEur: 0 });
    expect(row.ctr).toBeUndefined();
    expect(row.cpcEur).toBeUndefined();
    expect(row.cpaEur).toBeUndefined();
  });

  it("an unreadable error body is logged as empty and degrades to zeros", async () => {
    router([["pivot=CAMPAIGN", () => unreadable(429)]]);
    const [row] = await pull();
    expect(row.spendEur).toBe(0);
    expect(warn).toHaveBeenCalledWith("[ad-analytics/linkedin] adAnalytics 429 campaign=c1: ");
  });

  it("a non-Error failure is logged as-is", async () => {
    router([["pivot=CAMPAIGN", () => Promise.reject("socket reset")]]);
    await pull();
    expect(warn).toHaveBeenCalledWith(
      "[ad-analytics/linkedin] adAnalytics fetch failed campaign=c1:",
      "socket reset"
    );
  });
});

describe("demographic pivots", () => {
  it("missing elements, missing pivotValues/clicks and unreadable errors degrade cleanly", async () => {
    router([
      ["pivot=MEMBER_INDUSTRY", () => ok({})],
      [
        "pivot=MEMBER_SENIORITY",
        () => ok({ elements: [{ clicks: 4 }, { pivotValues: ["urn:li:seniority:3"] }] }),
      ],
      ["pivot=MEMBER_COMPANY_SIZE", () => unreadable(500)],
    ]);
    const [row] = await pull(["MEMBER_INDUSTRY", "MEMBER_SENIORITY", "MEMBER_COMPANY_SIZE"]);
    // only the seniority pivot produced a row; the clicks-less row is filtered out
    expect(row.demographics).toEqual({
      MEMBER_SENIORITY: [{ label: "Seniority #unknown", clicks: 4 }],
    });
    expect(warn).toHaveBeenCalledWith(
      "[ad-analytics/linkedin] pivot MEMBER_COMPANY_SIZE 500 campaign=c1: "
    );
  });
});

describe("creative leaderboard", () => {
  it("missing elements give no leaderboard", async () => {
    router([["pivot=CREATIVE", () => ok({})]]);
    const [row] = await pull();
    expect(row.creativeLeaderboard).toBeUndefined();
  });

  it("creatives without URNs or counts skip the name lookup and get blank ids", async () => {
    router([["pivot=CREATIVE", () => ok({ elements: [{}] })]]);
    const [row] = await pull();
    expect(row.creativeLeaderboard).toEqual([
      { creativeId: "", label: "Creative ", impressions: 0, clicks: 0, ctr: undefined },
    ]);
    expect(calledWith("/creatives?ids=")).toHaveLength(0);
  });

  it("bare ids, partial name records and a failed name lookup fall back to 'Creative <id>'", async () => {
    router([
      [
        "pivot=CREATIVE",
        () =>
          ok({
            elements: [
              { pivotValues: ["777"], impressions: 10, clicks: 1 },
              { pivotValues: ["urn:li:sponsoredCreative:8"], impressions: 10, clicks: 2 },
              { pivotValues: ["urn:li:sponsoredCreative:9"], impressions: 10, clicks: 3 },
            ],
          }),
      ],
      [
        "/creatives?ids=",
        () =>
          ok({
            results: { "urn:li:sponsoredCreative:8": {} },
            elements: [{ id: "urn:li:sponsoredCreative:9" }, { name: "orphan" }, null],
          }),
      ],
    ]);
    const [row] = await pull();
    expect(row.creativeLeaderboard!.map((c) => [c.creativeId, c.label])).toEqual([
      ["9", "Creative 9"],
      ["8", "Creative 8"],
      ["777", "Creative 777"],
    ]);

    router([
      [
        "pivot=CREATIVE",
        () =>
          ok({
            elements: [{ pivotValues: ["urn:li:sponsoredCreative:5"], clicks: 1, impressions: 2 }],
          }),
      ],
      ["/creatives?ids=", () => ({ ok: false, status: 403 }) as Response],
    ]);
    const [row2] = await pull();
    expect(row2.creativeLeaderboard).toEqual([
      { creativeId: "5", label: "Creative 5", impressions: 2, clicks: 1, ctr: 0.5 },
    ]);
  });

  it("a non-Error failure is logged as-is", async () => {
    router([["pivot=CREATIVE", () => Promise.reject("boom")]]);
    await pull();
    expect(warn).toHaveBeenCalledWith(
      "[ad-analytics/linkedin] creative leaderboard failed campaign=c1:",
      "boom"
    );
  });
});

describe("account spend", () => {
  it("a campaign list without elements is zero spend", async () => {
    router([["/adCampaigns", () => ok({})]]);
    expect(
      await linkedinAdapter.pullAccountSpendEur({ accountId: "512", since: "2026-06-01", until })
    ).toBe(0);
  });

  it("a non-Error list failure is logged as-is and returns null", async () => {
    router([["/adCampaigns", () => Promise.reject("dns")]]);
    expect(
      await linkedinAdapter.pullAccountSpendEur({ accountId: "512", since: "2026-06-01", until })
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[ad-analytics/linkedin] adCampaigns list failed acct=512:",
      "dns"
    );
  });
});

describe("CAPI pushConversion", () => {
  const push = (user?: Record<string, string>) =>
    linkedinAdapter.pushConversion({
      accountId: "a",
      conversionId: 42,
      eventId: "ev",
      happenedAt: new Date("2026-06-01T00:00:00Z"),
      user,
    });
  const sentUserIds = () =>
    JSON.parse(String((libs.fetch.mock.calls.at(-1)![1] as RequestInit).body)).user.userIds;

  it("maps only the identifiers that are present", async () => {
    router([["/conversionEvents", () => ok({})]]);
    await push({ ipAddress: "1.2.3.4" });
    expect(sentUserIds()).toEqual([{ idType: "PLAINTEXT_IP_ADDRESS", idValue: "1.2.3.4" }]);
    await push({ emailSha256: "e", phoneSha256: "p", liFatId: "li" });
    expect(sentUserIds()).toEqual([
      { idType: "SHA256_EMAIL", idValue: "e" },
      { idType: "SHA256_PHONE", idValue: "p" },
      { idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: "li" },
    ]);
  });

  it("an error with an unreadable body returns an empty message", async () => {
    router([["/conversionEvents", () => unreadable(500)]]);
    expect(await push()).toEqual({ accepted: false, status: 500, message: "" });
    expect(error).toHaveBeenCalledWith("[ad-analytics/linkedin] CAPI error 500: ");
  });

  it("a rejection without a message reports 'unknown error'", async () => {
    router([["/conversionEvents", () => Promise.reject({})]]);
    expect(await push()).toEqual({ accepted: false, status: 0, message: "unknown error" });
  });
});

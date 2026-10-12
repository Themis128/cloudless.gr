/**
 * Coverage tail for campaigns/{tiktok,x-ads} I/O paths — getTikTokInsights
 * and getXStats — which the pure-helper and campaign-list suites miss.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => ({
  cfg: {
    TIKTOK_ACCESS_TOKEN: "tt",
    TIKTOK_ADVERTISER_ID: "adv1",
    X_API_KEY: "xk",
    X_API_SECRET: "xs",
    X_ACCESS_TOKEN: "xt",
    X_ACCESS_SECRET: "xts",
    X_AD_ACCOUNT_ID: "acct1",
  } as Record<string, string>,
  fetch: vi.fn(),
}));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: async () => libs.cfg,
}));
vi.stubGlobal("fetch", libs.fetch);

import { getTikTokInsights } from "@/lib/campaigns/tiktok";
import { getXStats } from "@/lib/campaigns/x-ads";

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const bad = { ok: false, status: 500, json: async () => ({}) } as Response;

beforeEach(() => {
  libs.fetch.mockReset();
  Object.assign(libs.cfg, {
    TIKTOK_ACCESS_TOKEN: "tt",
    TIKTOK_ADVERTISER_ID: "adv1",
    X_API_KEY: "xk",
    X_ACCESS_TOKEN: "xt",
    X_AD_ACCOUNT_ID: "acct1",
  });
});

describe("getTikTokInsights", () => {
  it("POSTs the report body and parses the first row", async () => {
    libs.fetch.mockResolvedValue(
      ok({ data: { list: [{ metrics: { spend: "12.5", clicks: "9" } }] } })
    );
    const ins = await getTikTokInsights("2026-01-01", "2026-01-31");
    expect(ins.spend).toBe("12.5");
    expect(ins.clicks).toBe("9");
    expect(ins.impressions).toBe("0");

    const [url, init] = libs.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/report/integrated/get/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.advertiser_id).toBe("adv1");
    expect(body.start_date).toBe("2026-01-01");
  });

  it("returns empty insights on HTTP error, empty list, and network failure", async () => {
    libs.fetch.mockResolvedValue(bad);
    expect((await getTikTokInsights("a", "b")).spend).toBe("0");

    libs.fetch.mockResolvedValue(ok({ data: { list: [] } }));
    expect((await getTikTokInsights("a", "b")).clicks).toBe("0");

    libs.fetch.mockRejectedValue(new Error("net"));
    expect((await getTikTokInsights("a", "b")).ctr).toBe("0");

    // unconfigured → empty (getTikTokConfig throws)
    libs.cfg.TIKTOK_ACCESS_TOKEN = "";
    expect((await getTikTokInsights("a", "b")).cpc).toBe("0");
  });
});

describe("getXStats", () => {
  it("sends an OAuth1 Authorization header and maps metrics", async () => {
    libs.fetch.mockResolvedValue(
      ok({
        data: {
          id_data: [
            {
              id_data: {
                impressions: 10,
                clicks: 3,
                billed_charge_local_micro: 500,
                engagements: 7,
              },
            },
          ],
        },
      })
    );
    const s = await getXStats("2026-01-01", "2026-01-02");
    expect(s).toEqual({
      impressions: 10,
      clicks: 3,
      spend_micro: 500,
      engagements: 7,
    });

    const [url, init] = libs.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/stats/accounts/acct1");
    expect(url).toContain("start_time=2026-01-01T00:00:00Z");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toMatch(/^OAuth /);
    expect(auth).toContain("oauth_consumer_key");
    expect(auth).toContain("oauth_signature");
    expect(auth).toContain("HMAC-SHA1");
  });

  it("returns zeros on missing account id, HTTP error, empty payload, network failure", async () => {
    libs.cfg.X_AD_ACCOUNT_ID = "";
    expect(await getXStats("a", "b")).toEqual({
      impressions: 0,
      clicks: 0,
      spend_micro: 0,
      engagements: 0,
    });
    libs.cfg.X_AD_ACCOUNT_ID = "acct1";

    libs.fetch.mockResolvedValue(bad);
    expect((await getXStats("a", "b")).impressions).toBe(0);

    libs.fetch.mockResolvedValue(ok({ data: {} }));
    expect((await getXStats("a", "b")).clicks).toBe(0);

    libs.fetch.mockRejectedValue(new Error("net"));
    expect((await getXStats("a", "b")).engagements).toBe(0);

    libs.cfg.X_API_KEY = "";
    expect((await getXStats("a", "b")).spend_micro).toBe(0);
  });
});

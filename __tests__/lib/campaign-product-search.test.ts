/**
 * Tests for src/lib/campaigns/{linkedin,google-ads}.ts (control + I/O paths)
 * and src/lib/product-search.ts (meili pipeline + fallback search).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "crypto";

const libs = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({} as Record<string, string>)),
  getProducts: vi.fn(async () => [] as { id: string; name: string }[]),
  meiliRequest: vi.fn(),
  isMeilisearchConfigured: vi.fn(() => true),
  getMeiliAdminKey: vi.fn(() => "admin-key"),
  embedTextWithWorkersAi: vi.fn(async () => [0.1, 0.2]),
}));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => libs.getConfig(),
}));
vi.mock("@/lib/store-products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-products")>();
  return { ...actual, getProducts: () => libs.getProducts() };
});
vi.mock("@/lib/meilisearch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meilisearch")>();
  return {
    ...actual,
    meiliRequest: libs.meiliRequest,
    isMeilisearchConfigured: () => libs.isMeilisearchConfigured(),
    getMeiliAdminKey: () => libs.getMeiliAdminKey(),
  };
});
vi.mock("@/lib/workers-ai-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workers-ai-client")>();
  return {
    ...actual,
    embedTextWithWorkersAi: libs.embedTextWithWorkersAi,
    WORKERS_AI_EMBED_DIMENSIONS: 2,
  };
});

import {
  listLinkedInCampaigns,
  getLinkedInInsights,
  pauseLinkedInCampaign,
  resumeLinkedInCampaign,
  setLinkedInCampaignBudget,
  getLinkedInCampaignStatus,
} from "@/lib/campaigns/linkedin";
import {
  base64url,
  mapCampaignRow,
  parseMetricsRow,
  emptyMetrics,
  normalizeCustomerId,
  listGoogleCampaigns,
  getGoogleMetrics,
} from "@/lib/campaigns/google-ads";
import {
  ensureProductsSearchIndex,
  reindexProductsWithEmbeddings,
  searchProductsWithMeili,
  searchProductsFallback,
} from "@/lib/product-search";

const LI_CFG = {
  LINKEDIN_ACCESS_TOKEN: "tok",
  LINKEDIN_AD_ACCOUNT_ID: "urn:li:sponsoredAccount:1",
  LINKEDIN_ORGANIZATION_URN: "urn:li:org:1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("campaigns/linkedin — insights + control", () => {
  it("getLinkedInInsights maps the first element, empty on failures", async () => {
    libs.getConfig.mockResolvedValue(LI_CFG);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            impressions: 10,
            clicks: 2,
            costInLocalCurrency: "12.3",
            externalWebsiteConversions: 1,
          },
        ],
      }),
    } as Response);
    expect(await getLinkedInInsights("2026-01-01", "2026-02-01")).toEqual({
      impressions: 10,
      clicks: 2,
      costInLocalCurrency: "12.3",
      conversions: 1,
    });
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("dateRange.start.year=2026");
    expect(url).toContain("dateRange.end.day=1");

    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    expect((await getLinkedInInsights("a-b", "c-d")).impressions).toBe(0);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    expect((await getLinkedInInsights("a-b", "c-d")).conversions).toBe(0);
  });

  it("pause/resume/budget send PARTIAL_UPDATE patches; error mapping", async () => {
    libs.getConfig.mockResolvedValue(LI_CFG);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    expect(await pauseLinkedInCampaign("c1")).toEqual({ ok: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      "X-Restli-Method": "PARTIAL_UPDATE",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      patch: { $set: { status: "PAUSED" } },
    });

    await resumeLinkedInCampaign("c1");
    const body2 = JSON.parse(
      (vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string
    );
    expect(body2.patch.$set.status).toBe("ACTIVE");

    await setLinkedInCampaignBudget("c1", 25);
    const body3 = JSON.parse(
      (vi.mocked(fetch).mock.calls[2][1] as RequestInit).body as string
    );
    expect(body3.patch.$set.dailyBudget).toEqual({
      amount: "2500",
      currencyCode: "EUR",
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "denied",
    } as Response);
    expect((await pauseLinkedInCampaign("c1")).error).toBe("403: denied");

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect((await resumeLinkedInCampaign("c1")).error).toBe("net");
  });

  it("getLinkedInCampaignStatus returns parsed budget + error paths", async () => {
    libs.getConfig.mockResolvedValue(LI_CFG);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "Camp",
        status: "ACTIVE",
        dailyBudget: { amount: "1000" },
      }),
    } as Response);
    expect(await getLinkedInCampaignStatus("c1")).toEqual({
      ok: true,
      name: "Camp",
      status: "ACTIVE",
      dailyBudget: "€10.00",
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ name: "NoBudget" }),
    } as Response);
    expect((await getLinkedInCampaignStatus("c1")).dailyBudget).toBe("not set");

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "gone",
    } as Response);
    expect((await getLinkedInCampaignStatus("c1")).error).toBe("404: gone");

    vi.mocked(fetch).mockRejectedValue(new Error("down"));
    expect((await getLinkedInCampaignStatus("c1")).error).toBe("down");
  });

  it("listLinkedInCampaigns maps + null budget", async () => {
    libs.getConfig.mockResolvedValue(LI_CFG);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 7,
            name: "C",
            status: "ACTIVE",
            type: "SPONSORED_UPDATES",
            objectiveType: "WEBSITE_VISITS",
            totalBudget: { amount: "100", currencyCode: "EUR" },
            changeAuditStamps: {
              created: { time: 1 },
              lastModified: { time: 2 },
            },
          },
          {
            id: 8,
            name: "D",
            status: "PAUSED",
            type: "T",
            objectiveType: "O",
            changeAuditStamps: {},
          },
        ],
      }),
    } as Response);
    const camps = await listLinkedInCampaigns();
    expect(camps[0]).toMatchObject({
      id: "7",
      totalBudget: { amount: "100", currencyCode: "EUR" },
      createdAt: 1,
      lastModifiedAt: 2,
    });
    expect(camps[1]).toMatchObject({ id: "8", totalBudget: null, createdAt: 0 });
  });
});

describe("campaigns/google-ads", () => {
  it("pure helpers", () => {
    expect(base64url("a+b/c=")).toBe("YStiL2M9");
    expect(normalizeCustomerId("123-456")).toBe("123456");
    expect(emptyMetrics()).toEqual({
      impressions: 0,
      clicks: 0,
      costMicros: 0,
      conversions: 0,
      ctr: 0,
    });
    expect(
      mapCampaignRow({
        campaign: {
          id: "1",
          name: "n",
          status: "ENABLED",
          advertisingChannelType: "SEARCH",
          startDate: "s",
          endDate: "e",
        },
      })
    ).toMatchObject({ id: "1", budgetAmountMicros: "0" });
    expect(
      parseMetricsRow({
        impressions: "10",
        clicks: "2",
        costMicros: "500",
        conversions: "1.5",
        ctr: "0.2",
      })
    ).toEqual({
      impressions: 10,
      clicks: 2,
      costMicros: 500,
      conversions: 1.5,
      ctr: 0.2,
    });
    expect(parseMetricsRow(null)).toEqual(emptyMetrics());
  });

  it("listGoogleCampaigns + getGoogleMetrics through the token+search flow", async () => {
    libs.getConfig.mockResolvedValue({
      GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
      GOOGLE_ADS_CUSTOMER_ID: "123-456",
    });
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    process.env.GOOGLE_CLIENT_EMAIL = "svc@x.iam";
    process.env.GOOGLE_PRIVATE_KEY = privateKey;

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: async () => ({ access_token: "ya29.tok" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              campaign: {
                id: "c1",
                name: "G1",
                status: "ENABLED",
                advertisingChannelType: "SEARCH",
                startDate: "2026-01-01",
                endDate: "2026-02-01",
              },
              campaignBudget: { amountMicros: "5000" },
            },
          ],
        }),
      } as Response);

    const camps = await listGoogleCampaigns();
    expect(camps).toEqual([
      {
        id: "c1",
        name: "G1",
        status: "ENABLED",
        advertisingChannelType: "SEARCH",
        budgetAmountMicros: "5000",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      },
    ]);
    const [searchUrl, searchInit] = vi.mocked(fetch).mock.calls[1];
    expect(String(searchUrl)).toContain("/customers/123456/googleAds:search");
    expect((searchInit as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ya29.tok",
      "developer-token": "dev",
      "login-customer-id": "123456",
    });

    // token is cached — only the search call this time
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { metrics: { impressions: "5", clicks: "1", costMicros: "9" } },
        ],
      }),
    } as Response);
    const m = await getGoogleMetrics("2026-01-01", "2026-01-31");
    expect(m).toMatchObject({ impressions: 5, clicks: 1, costMicros: 9 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);

    // unconfigured → []
    libs.getConfig.mockResolvedValue({});
    expect(await listGoogleCampaigns()).toEqual([]);
    expect(await getGoogleMetrics("a", "b")).toEqual(emptyMetrics());

    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
  });
});

describe("product-search meili pipeline", () => {
  const idx = "products";

  it("ensureProductsSearchIndex PATCHes settings + waits for task", async () => {
    libs.meiliRequest
      .mockResolvedValueOnce({ taskUid: 9 })
      .mockResolvedValueOnce({ status: "succeeded" });
    await ensureProductsSearchIndex();
    expect(libs.meiliRequest).toHaveBeenNthCalledWith(
      1,
      `/indexes/${idx}/settings`,
      expect.objectContaining({ method: "PATCH" }),
      "admin-key"
    );
    expect(libs.meiliRequest).toHaveBeenNthCalledWith(
      2,
      "/tasks/9",
      {},
      "admin-key"
    );
  });

  it("reindex: full delete→create→settings→embed→post pipeline", async () => {
    libs.getProducts.mockResolvedValue([
      { id: "p1", name: "Audit", description: "d", category: "c" },
    ]);
    // delete-index task, create-index task, settings task, doc-post task —
    // each followed by a /tasks/<uid> poll that returns succeeded.
    libs.meiliRequest.mockImplementation(async (path: string) => {
      if (path === `/indexes/${idx}`) return { taskUid: 1 }; // DELETE
      if (path === "/indexes") return { taskUid: 2 }; // POST create
      if (path === `/indexes/${idx}/settings`) return { taskUid: 3 };
      if (path === `/indexes/${idx}/documents`) return { taskUid: 4 };
      return { status: "succeeded" }; // /tasks/* polls
    });

    const out = await reindexProductsWithEmbeddings();
    expect(out).toEqual({ indexed: 1, taskUid: 4 });
    const docCall = libs.meiliRequest.mock.calls.find(
      (c) => c[0] === `/indexes/${idx}/documents`
    );
    const docs = JSON.parse((docCall![1] as RequestInit).body as string);
    expect(docs[0]._vectors).toBeDefined();
    expect(docs[0].href).toBe("/store/p1");
    expect(libs.embedTextWithWorkersAi).toHaveBeenCalled();
  });

  it("reindex throws when meili unconfigured or a task fails", async () => {
    libs.isMeilisearchConfigured.mockReturnValue(false);
    await expect(reindexProductsWithEmbeddings()).rejects.toThrow(
      "not configured"
    );
    libs.isMeilisearchConfigured.mockReturnValue(true);

    libs.meiliRequest.mockImplementation(async (path: string) => {
      if (path.startsWith("/tasks/"))
        return { status: "failed", error: { message: "boom" } };
      return { taskUid: 5 };
    });
    await expect(reindexProductsWithEmbeddings()).rejects.toThrow(
      "task 5 failed: boom"
    );
  });

  it("searchProductsWithMeili hybrid query; fallback keyword filter", async () => {
    libs.meiliRequest.mockResolvedValue({ hits: [{ id: "p1", _rankingScore: 1 }] });
    const hits = await searchProductsWithMeili("audit", 3);
    expect(hits).toEqual([{ id: "p1", _rankingScore: 1 }]);
    const body = JSON.parse(
      (libs.meiliRequest.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toMatchObject({
      q: "audit",
      limit: 3,
      hybrid: { semanticRatio: 0.55 },
      showRankingScore: true,
    });

    libs.getProducts.mockResolvedValue([
      { id: "a", name: "Cloud Audit", description: "x", category: "svc" },
      { id: "b", name: "Other", description: "y", category: "misc" },
    ]);
    const fb = await searchProductsFallback("audit");
    expect(fb.map((h) => h.id)).toEqual(["a"]);
  });
});

/**
 * Tests for /api/admin/campaigns/{crm-leads,meta,meta/insights},
 * /api/admin/gsc/sitemaps, /api/admin (root) and /api/admin/search/reindex.
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

const campaigns = vi.hoisted(() => ({ getLiveCampaigns: vi.fn() }));
vi.mock("@/data/campaigns", () => campaigns);

const espo = vi.hoisted(() => ({
  countLeadsForCampaign: vi.fn(),
  isEspoCRMConfigured: vi.fn(),
}));
vi.mock("@/lib/espocrm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/espocrm")>();
  return { ...actual, ...espo };
});

const metaAds = vi.hoisted(() => ({
  isMetaAdsConfigured: vi.fn(),
  listMetaCampaigns: vi.fn(),
  getMetaInsights: vi.fn(),
}));
vi.mock("@/lib/campaigns/meta-ads", () => metaAds);

const gsc = vi.hoisted(() => ({
  listSitemaps: vi.fn(),
  submitSitemap: vi.fn(),
  deleteSitemap: vi.fn(),
}));
vi.mock("@/lib/gsc-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gsc-admin")>();
  return { ...actual, ...gsc };
});

const ssm = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ssm);

const search = vi.hoisted(() => ({
  reindexProductsWithEmbeddings: vi.fn(),
  syncContentIndex: vi.fn(),
}));
vi.mock("@/lib/product-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-search")>();
  return {
    ...actual,
    reindexProductsWithEmbeddings: search.reindexProductsWithEmbeddings,
  };
});
vi.mock("@/lib/content-index", () => ({
  syncContentIndex: search.syncContentIndex,
}));

import { GET as crmGet } from "@/app/api/admin/campaigns/crm-leads/route";
import { GET as metaGet } from "@/app/api/admin/campaigns/meta/route";
import { GET as metaInsightsGet } from "@/app/api/admin/campaigns/meta/insights/route";
import {
  GET as sitemapsGet,
  POST as sitemapsPost,
  DELETE as sitemapsDelete,
} from "@/app/api/admin/gsc/sitemaps/route";
import { GET as adminRootGet } from "@/app/api/admin/route";
import { POST as reindexPost } from "@/app/api/admin/search/reindex/route";

const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("campaigns routes", () => {
  it("crm-leads: 503 unconfigured; rolls up counts per live campaign", async () => {
    espo.isEspoCRMConfigured.mockResolvedValue(false);
    expect(
      (await crmGet(new NextRequest("http://x/api/admin/campaigns/crm-leads")))
        .status
    ).toBe(503);

    espo.isEspoCRMConfigured.mockResolvedValue(true);
    campaigns.getLiveCampaigns.mockReturnValue([
      { slug: "a" },
      { slug: "b" },
    ]);
    espo.countLeadsForCampaign.mockImplementation(async (slug: string) =>
      slug === "a" ? 5 : 2
    );
    const j = await (
      await crmGet(new NextRequest("http://x/api/admin/campaigns/crm-leads"))
    ).json();
    expect(j.rollups).toEqual([
      { slug: "a", leadCount: 5 },
      { slug: "b", leadCount: 2 },
    ]);
    expect(j.total).toBe(7);
  });

  it("meta: 503 unconfigured, lists, 500 on failure", async () => {
    metaAds.isMetaAdsConfigured.mockResolvedValue(false);
    expect(
      (await metaGet(new NextRequest("http://x/api/admin/campaigns/meta")))
        .status
    ).toBe(503);

    metaAds.isMetaAdsConfigured.mockResolvedValue(true);
    metaAds.listMetaCampaigns.mockResolvedValue([{ id: "c" }]);
    const j = await (
      await metaGet(new NextRequest("http://x/api/admin/campaigns/meta"))
    ).json();
    expect(j.total).toBe(1);

    metaAds.listMetaCampaigns.mockRejectedValue(new Error("meta down"));
    expect(
      (await metaGet(new NextRequest("http://x/api/admin/campaigns/meta")))
        .status
    ).toBe(500);
  });

  it("meta/insights: passes date range", async () => {
    metaAds.isMetaAdsConfigured.mockResolvedValue(true);
    metaAds.getMetaInsights.mockResolvedValue({ spend: 10 });
    const j = await (
      await metaInsightsGet(
        new NextRequest(
          "http://x/api/admin/campaigns/meta/insights?start=2026-01-01&end=2026-02-01"
        )
      )
    ).json();
    expect(j.insights.spend).toBe(10);
    expect(metaAds.getMetaInsights).toHaveBeenCalledWith(
      "2026-01-01",
      "2026-02-01"
    );

    await metaInsightsGet(
      new NextRequest("http://x/api/admin/campaigns/meta/insights")
    );
    const [s, e] = metaAds.getMetaInsights.mock.calls[1];
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("gsc sitemaps", () => {
  it("GET lists; POST submits (default path); DELETE requires path", async () => {
    gsc.listSitemaps.mockResolvedValue([{ path: "sitemap.xml" }]);
    const j = await (
      await sitemapsGet(new NextRequest("http://x/api/admin/gsc/sitemaps"))
    ).json();
    expect(j).toHaveLength(1);

    expect(
      (await sitemapsPost(post("http://x/api/admin/gsc/sitemaps", "{bad")))
        .status
    ).toBe(400);

    gsc.submitSitemap.mockResolvedValue({ submitted: true });
    await sitemapsPost(post("http://x/api/admin/gsc/sitemaps", {}));
    expect(gsc.submitSitemap).toHaveBeenCalledWith("sitemap.xml");

    await sitemapsPost(post("http://x/api/admin/gsc/sitemaps", { path: "news.xml" }));
    expect(gsc.submitSitemap).toHaveBeenLastCalledWith("news.xml");

    expect(
      (
        await sitemapsDelete(
          post("http://x/api/admin/gsc/sitemaps", {}, "DELETE")
        )
      ).status
    ).toBe(400);

    gsc.deleteSitemap.mockResolvedValue({ deleted: true });
    const j2 = await (
      await sitemapsDelete(
        post("http://x/api/admin/gsc/sitemaps", { path: "news.xml" }, "DELETE")
      )
    ).json();
    expect(j2.deleted).toBe(true);
    expect(gsc.deleteSitemap).toHaveBeenCalledWith("news.xml");
  });
});

describe("admin root + search reindex", () => {
  it("admin root: 401 anon, ok admin", async () => {
    apiAuth.ok = false;
    expect(
      (await adminRootGet(new NextRequest("http://x/api/admin"))).status
    ).toBe(401);
    apiAuth.ok = true;
    expect(
      (await (await adminRootGet(new NextRequest("http://x/api/admin"))).json())
        .ok
    ).toBe(true);
  });

  it("reindex: secret-gated, runs both jobs", async () => {
    ssm.getConfig.mockResolvedValue({ CRON_SECRET: "s3cret" });
    const req = (secret: string | null) =>
      new NextRequest("http://x/api/admin/search/reindex", {
        method: "POST",
        headers: secret ? { "x-cron-secret": secret } : {},
      });

    expect((await reindexPost(req(null))).status).toBe(401);
    expect((await reindexPost(req("wrong"))).status).toBe(401);

    ssm.getConfig.mockResolvedValue({});
    expect((await reindexPost(req("x"))).status).toBe(401);

    ssm.getConfig.mockResolvedValue({ CRON_SECRET: "s3cret" });
    search.reindexProductsWithEmbeddings.mockResolvedValue({ indexed: 3 });
    search.syncContentIndex.mockResolvedValue({ pages: 8 });
    const j = await (await reindexPost(req("s3cret"))).json();
    expect(j).toEqual({ ok: true, products: { indexed: 3 }, content: { pages: 8 } });
  });
});

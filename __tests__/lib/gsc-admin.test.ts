/**
 * gsc-admin.ts — GSC admin surface: sitemap list/submit/delete,
 * URL inspection, Indexing API notify/status, crawl stats loop.
 * Google auth + fetch faked at the boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockToken } = vi.hoisted(() => ({ mockToken: vi.fn() }));
vi.mock("@/lib/google-auth", () => ({
  createGoogleAuth: vi.fn(() => mockToken),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  listSitemaps,
  submitSitemap,
  deleteSitemap,
  inspectUrl,
  requestIndexing,
  getIndexingStatus,
  getCrawlStats,
} from "@/lib/gsc-admin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mockToken.mockResolvedValue("ya29.token");
});

describe("sitemaps", () => {
  it("listSitemaps maps entries + throws on !ok", async () => {
    mockFetch.mockResolvedValueOnce(json({ sitemap: [{ path: "/s.xml", lastSubmitted: "t" }] }));
    const r = await listSitemaps();
    expect(r.sitemaps).toEqual([{ path: "/s.xml", lastSubmitted: "t" }]);
    expect(String(mockFetch.mock.calls[0][0])).toContain("webmasters/v3/sites/");

    mockFetch.mockResolvedValueOnce(json({}));
    expect((await listSitemaps()).sitemaps).toEqual([]);

    mockFetch.mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await expect(listSitemaps()).rejects.toThrow("sitemaps list 403");
  });

  it("submitSitemap PUTs the feed path + throws on !ok", async () => {
    mockFetch.mockResolvedValueOnce(json({}));
    const r = await submitSitemap("https://cloudless.gr/sitemap.xml");
    expect(r).toEqual({ ok: true, path: "https://cloudless.gr/sitemap.xml", siteUrl: expect.any(String) });
    expect(mockFetch.mock.calls[0][1].method).toBe("PUT");

    mockFetch.mockResolvedValueOnce(new Response("bad", { status: 400 }));
    await expect(submitSitemap("x")).rejects.toThrow("sitemap submit 400");
  });

  it("deleteSitemap issues DELETE + throws on !ok", async () => {
    mockFetch.mockResolvedValueOnce(json({}));
    await deleteSitemap("https://cloudless.gr/sitemap.xml");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");

    mockFetch.mockResolvedValueOnce(new Response("nf", { status: 404 }));
    await expect(deleteSitemap("x")).rejects.toThrow("sitemap delete 404");
  });
});

describe("inspection + indexing", () => {
  it("inspectUrl posts inspectionUrl + returns result; throws on !ok", async () => {
    const result = { inspectionResult: { indexStatusResult: { verdict: "PASS" } } };
    mockFetch.mockResolvedValueOnce(json(result));
    expect(await inspectUrl("https://cloudless.gr/x")).toEqual(result);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.inspectionUrl).toBe("https://cloudless.gr/x");

    mockFetch.mockResolvedValueOnce(new Response("e", { status: 429 }));
    await expect(inspectUrl("u")).rejects.toThrow("URL inspection 429");
  });

  it("requestIndexing posts URL_UPDATED; getIndexingStatus GETs metadata", async () => {
    const meta = { urlNotificationMetadata: { url: "u" } };
    mockFetch.mockResolvedValueOnce(json(meta));
    expect(await requestIndexing("https://cloudless.gr/x")).toEqual(meta);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body as string).type).toBe("URL_UPDATED");

    mockFetch.mockResolvedValueOnce(json(meta));
    expect(await getIndexingStatus("https://cloudless.gr/x")).toEqual(meta);
    expect(String(mockFetch.mock.calls[1][0])).toContain("metadata?url=");

    mockFetch.mockResolvedValueOnce(new Response("e", { status: 500 }));
    await expect(requestIndexing("u")).rejects.toThrow("Indexing API 500");
    mockFetch.mockResolvedValueOnce(new Response("e", { status: 500 }));
    await expect(getIndexingStatus("u")).rejects.toThrow("Indexing API status 500");
  });
});

describe("getCrawlStats", () => {
  it("aggregates per-category samples, skipping !ok categories", async () => {
    mockFetch
      .mockResolvedValueOnce(json({ samples: [{ url: "a", last_crawled: "t" }] })) // not_found
      .mockResolvedValueOnce(new Response("", { status: 403 })) // server_error skipped
      .mockResolvedValueOnce(json({ samples: [] })) // soft_404 empty
      .mockResolvedValueOnce(json({ samples: [{ url: "b", last_crawled: "t" }] })); // ok
    const r = await getCrawlStats();
    expect(r.samples).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(String(mockFetch.mock.calls[0][0])).toContain("category=not_found");
  });

  it("category fetch throw → skipped, not fatal", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("net"))
      .mockRejectedValueOnce(new Error("net"))
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce(json({ samples: [{ url: "x", last_crawled: "t" }] }));
    const r = await getCrawlStats();
    expect(r.samples).toHaveLength(1);
  });
});

/**
 * Populated-state interaction tests for the GSC admin page — sitemap
 * submit/delete/list (pending/error/active states), URL inspection
 * results (index status, mobile issues, rich results, missing sections),
 * indexing notify, crawl-errors summary cards + problem URLs.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  const key = `${method} ${url}`;
  const out = routes[key] ?? routes[url];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({ sitemaps: [], samples: [] });
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import GscAdminPage from "@/app/[locale]/admin/gsc/page";

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<GscAdminPage />).container;
  });
  return c!;
}

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

describe("gsc admin — populated interactions", () => {
  beforeEach(() => {
    routes = {};
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sitemaps — list with pending/error/active, submit, delete, load error", async () => {
    routes["GET /api/admin/gsc/sitemaps"] = {
      sitemaps: [
        { path: "/sitemap.xml", lastSubmitted: "2026-01-01", lastDownloaded: "2026-01-02", isPending: false, isSitemapsIndex: false, type: "sitemap", warnings: "1" },
        { path: "/news.xml", isPending: true, isSitemapsIndex: false, type: "sitemap" },
        { path: "/bad.xml", isPending: false, isSitemapsIndex: false, type: "sitemap", errors: "3" },
      ],
    };
    const c = await renderPage(); // sitemaps is the default tab
    expect(c.textContent).toContain("/sitemap.xml");
    expect(c.textContent).toContain("Pending");
    expect(c.textContent).toContain("Has errors");
    expect(c.textContent).toContain("Active");

    // submit
    const input = c.querySelector("input[placeholder='sitemap.xml']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "extra.xml" } });
    routes["POST /api/admin/gsc/sitemaps"] = { ok: true };
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain('Submitted "extra.xml"');
    const postCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("sitemaps") && i?.method === "POST"
    );
    expect(JSON.parse(String(postCall![1].body))).toEqual({ path: "extra.xml" });

    // delete (confirm stubbed true)
    routes["DELETE /api/admin/gsc/sitemaps"] = { ok: true };
    await click(screen.getAllByText("Remove")[0]);
    expect(c.textContent).toContain('Removed "/sitemap.xml"');

    // submit error + delete error
    routes["POST /api/admin/gsc/sitemaps"] = okJson({ error: "quota" }, 429);
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("❌ quota");
    routes["DELETE /api/admin/gsc/sitemaps"] = okJson({ error: "gone" }, 404);
    await click(screen.getAllByText("Remove")[0]);
    expect(c.textContent).toContain("❌ gone");

    // load error
    routes["GET /api/admin/gsc/sitemaps"] = new Response("x", { status: 500 });
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("Failed to load: HTTP 500");

    // empty state
    routes["GET /api/admin/gsc/sitemaps"] = { sitemaps: [] };
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("No sitemaps submitted yet.");
  });

  it("inspect — full result render + error + missing sections", async () => {
    const c = await renderPage();
    await click(screen.getByText("URL Inspection"));

    routes["POST /api/admin/gsc/inspect"] = {
      url: "https://cloudless.gr/x",
      inspectionResult: {
        inspectionStatus: "OK",
        indexStatusResult: {
          verdict: "PASS",
          coverageState: "Indexed",
          robotsTxtState: "ALLOWED",
          indexed: true,
          lastCrawlTime: "2026-01-01",
          pageFetchState: "SUCCESSFUL",
          googleCanonical: "https://cloudless.gr/x",
          userCanonical: "https://cloudless.gr/x",
          sitemap: "/sitemap.xml",
          crawledAs: "MOBILE",
        },
        mobileUsabilityResult: {
          verdict: "FAIL",
          issues: [{ issueType: "TEXT_TOO_SMALL", severity: "ERROR", message: "Tiny text" }],
        },
        richResultsResult: {
          verdict: "PASS",
          detectedItems: [
            { richResultType: "FAQ", items: 2 },
            { richResultType: "Article", items: 1 },
          ],
        },
      },
    };

    const input = c.querySelector("input[type='url']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://cloudless.gr/x" } });
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});

    expect(c.textContent).toContain("Indexed");
    expect(c.textContent).toContain("MOBILE");
    expect(c.textContent).toContain("TEXT_TOO_SMALL");
    expect(c.textContent).toContain("Tiny text");
    expect(c.textContent).toContain("FAQ — 2 items");
    expect(c.textContent).toContain("Article — 1 item");

    // sparse result — no idx → fallback text; error path
    routes["POST /api/admin/gsc/inspect"] = { url: "u", inspectionResult: { inspectionStatus: "OK" } };
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("No index status data returned.");

    routes["POST /api/admin/gsc/inspect"] = okJson({ error: "rate" }, 429);
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("rate");
  });

  it("inspect — mobile no-issues + rich no-items variants", async () => {
    const c = await renderPage();
    await click(screen.getByText("URL Inspection"));
    routes["POST /api/admin/gsc/inspect"] = {
      url: "u",
      inspectionResult: {
        inspectionStatus: "OK",
        indexStatusResult: { verdict: "NEUTRAL", coverageState: "x", robotsTxtState: "y", pageFetchState: "z" },
        mobileUsabilityResult: { verdict: "PASS", issues: [] },
        richResultsResult: { verdict: "NEUTRAL", detectedItems: [] },
      },
    };
    const input = c.querySelector("input[type='url']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x" } });
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("No mobile usability issues detected.");
    expect(c.textContent).toContain("No rich results detected.");
    expect(c.textContent).toContain("NEUTRAL");
  });

  it("index tab — notify success + error", async () => {
    const c = await renderPage();
    await click(screen.getByText("Request Indexing"));

    routes["POST /api/admin/gsc/index"] = {
      ok: true,
      url: "https://cloudless.gr/new",
      urlNotificationMetadata: { latestUpdate: { type: "URL_UPDATED", notifyTime: "2026-01-01" } },
    };
    const input = c.querySelector("input[type='url']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://cloudless.gr/new" } });
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("Notification Sent");
    expect(c.textContent).toContain("URL_UPDATED");

    routes["POST /api/admin/gsc/index"] = okJson({ error: "denied" }, 403);
    fireEvent.submit(c.querySelector("form")!);
    await act(async () => {});
    expect(c.textContent).toContain("denied");
  });

  it("crawl tab — summary cards, problem URLs, ok banner, empty + error", async () => {
    routes["GET /api/admin/gsc/crawl-stats"] = {
      samples: [
        {
          category: "not_found",
          pageCount: 3,
          sampleUrls: [
            { url: "https://cloudless.gr/gone", responseState: "404", lastCrawlTime: "2026-01-01" },
            { url: "https://cloudless.gr/dead" },
          ],
        },
        { category: "server_error", pageCount: 1, sampleUrls: [{ url: "https://x/err", crawlState: "ERR" }] },
        { category: "unknown_cat", pageCount: 2, sampleUrls: [] },
        { category: "ok", pageCount: 42, sampleUrls: [] },
      ],
    };
    const c = await renderPage();
    await click(screen.getByText("Crawl Errors"));

    expect(c.textContent).toContain("404 Not Found");
    expect(c.textContent).toContain("Server Errors (5xx)");
    expect(c.textContent).toContain("unknown_cat"); // falls back to raw category
    expect(c.textContent).toContain("https://cloudless.gr/gone");
    expect(c.textContent).toContain("404"); // responseState chip
    expect(c.textContent).toContain("42 pages crawled successfully");

    // empty + error
    routes["GET /api/admin/gsc/crawl-stats"] = { samples: [] };
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("No crawl errors detected");

    routes["GET /api/admin/gsc/crawl-stats"] = new Response("x", { status: 502 });
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("Failed to load: HTTP 502");
  });
});

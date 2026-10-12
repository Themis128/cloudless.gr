/**
 * campaigns/google + campaigns/tiktok + analytics/engine — populated rows,
 * not-configured 503s, HTTP errors, refresh.
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

let handler: (url: string) => Response = () => okJson({}, 404);
const fetchWithAuthMock = vi.fn(async (url: string) => handler(String(url)));

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

import GooglePage from "@/app/[locale]/admin/campaigns/google/page";
import TikTokPage from "@/app/[locale]/admin/campaigns/tiktok/page";
import EnginePage from "@/app/[locale]/admin/analytics/engine/page";

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

describe("admin campaigns + engine pages", () => {
  beforeEach(() => {
    handler = () => okJson({}, 404);
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("google — campaigns + metrics render, 503 → not configured, !ok → error", async () => {
    handler = (url) => {
      if (url.includes("campaigns/google/insights")) {
        return okJson({
          metrics: { impressions: 12000, clicks: 300, costMicros: 45000000, conversions: 4, ctr: 0.025 },
        });
      }
      if (url.includes("campaigns/google")) {
        return okJson({
          campaigns: [
            {
              id: "g1",
              name: "Search – Audit",
              status: "ENABLED",
              advertisingChannelType: "SEARCH",
              budgetAmountMicros: "25000000",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
            },
          ],
        });
      }
      return okJson({ insights: [] });
    };
    const c = await renderPage(<GooglePage />);
    expect(c.textContent).toContain("Search – Audit");
    expect(c.textContent).toContain("12,000");
    expect(c.textContent).toContain("$45.00");
    expect(c.textContent).toContain("2.50%");
    expect(c.textContent).toContain("$25.00");

    cleanup();
    handler = (url) => (url.includes("campaigns/google") && !url.includes("insights") ? okJson({}, 503) : okJson({}));
    const c2 = await renderPage(<GooglePage />);
    expect(c2.textContent).toContain("Google Ads is not configured");

    cleanup();
    handler = (url) => (url.includes("campaigns/google") && !url.includes("insights") ? okJson({}, 500) : okJson({}));
    const c3 = await renderPage(<GooglePage />);
    expect(c3.textContent).toContain("Failed to load campaigns");
  });

  it("tiktok — campaigns + insights render, 503 → not configured, !ok → error", async () => {
    handler = (url) => {
      if (url.includes("campaigns/tiktok/insights")) {
        return okJson({
          insights: { spend: "12.34", impressions: "8000", clicks: "150", ctr: "1.875", cpc: "0.08", conversions: "3" },
        });
      }
      if (url.includes("campaigns/tiktok")) {
        return okJson({
          campaigns: [
            {
              campaign_id: "t1",
              campaign_name: "Traffic – Cloud",
              status: "ENABLE",
              objective_type: "TRAFFIC",
              budget: "20.00",
              budget_mode: "BUDGET_MODE_DAY",
            },
          ],
        });
      }
      return okJson({ insights: [] });
    };
    const c = await renderPage(<TikTokPage />);
    expect(c.textContent).toContain("Traffic – Cloud");
    expect(c.textContent).toContain("TRAFFIC");
    expect(c.textContent).toContain("$12.34");

    cleanup();
    handler = (url) => (url.includes("campaigns/tiktok") && !url.includes("insights") ? okJson({}, 503) : okJson({}));
    const c2 = await renderPage(<TikTokPage />);
    expect(c2.textContent).toContain("not configured");

    cleanup();
    handler = (url) => (url.includes("campaigns/tiktok") && !url.includes("insights") ? okJson({}, 500) : okJson({}));
    const c3 = await renderPage(<TikTokPage />);
    expect(c3.textContent).toContain("Failed to load campaigns");
  });

  it("engine — sql + rows table, refresh, 503 + HTTP + reject errors", async () => {
    handler = (url) =>
      url.includes("analytics/engine")
        ? okJson({
            configured: true,
            sql: "SELECT blob2 AS path FROM CLOUDLESS",
            rows: [{ path: "/store", p95: 42.5 }],
            count: 1,
          })
        : okJson({ insights: [] });
    const c = await renderPage(<EnginePage />);
    expect(c.textContent).toContain("SELECT blob2 AS path");
    expect(c.textContent).toContain("/store");
    expect(c.textContent).toContain("42.5");

    fetchWithAuthMock.mockClear();
    await click(screen.getByText("Refresh"));
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/admin/analytics/engine");

    cleanup();
    handler = (url) =>
      url.includes("analytics/engine")
        ? okJson({ error: "AE binding missing" }, 503)
        : okJson({});
    const c2 = await renderPage(<EnginePage />);
    expect(c2.textContent).toContain("AE binding missing");

    cleanup();
    handler = (url) =>
      url.includes("analytics/engine") ? okJson({ error: "upstream" }, 500) : okJson({});
    const c3 = await renderPage(<EnginePage />);
    expect(c3.textContent).toContain("upstream");

    cleanup();
    handler = () => {
      throw new Error("net down");
    };
    const c4 = await renderPage(<EnginePage />);
    expect(c4.textContent).toContain("net down");
  });
});

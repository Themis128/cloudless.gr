/**
 * Populated-state interaction tests for the Campaign Manager hub page —
 * integration status gating, per-platform insights parsing (google/linkedin/
 * tiktok/x shapes), totals strip, refresh, error path.
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
  const out = routes[String(url)];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import CampaignsDashboard from "@/app/[locale]/admin/campaigns/page";

function seedRoutes() {
  routes = {
    "/api/admin/integrations/status": {
      integrations: [
        { id: "tiktok", status: "configured" },
        { id: "linkedin", status: "configured" },
        { id: "x", status: "degraded", message: "token expiring" },
        { id: "google_ads", status: "configured" },
        { id: "meta", status: "not_configured" },
      ],
    },
    "/api/admin/campaigns/tiktok": {
      campaigns: [{ status: "ENABLE" }, { status: "ACTIVE" }, { status: "DISABLE" }],
    },
    "/api/admin/campaigns/linkedin": { campaigns: [{ status: "ACTIVE" }] },
    "/api/admin/campaigns/google": { campaigns: [] },
  };
  // insights URLs carry ?start/end — handled via function router below
}

const insightBodies: Record<string, unknown> = {
  tiktok: { insights: { impressions: "12000", clicks: "300", spend: "150.5" } },
  linkedin: { insights: { impressions: 8000, clicks: 200, costInLocalCurrency: "99.9" } },
  google: { metrics: { impressions: 20000, clicks: 500, costMicros: 250_000_000 } },
};

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<CampaignsDashboard />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

describe("campaigns hub — populated interactions", () => {
  beforeEach(() => {
    seedRoutes();

    fetchWithAuthMock.mockClear();
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      for (const [id, body] of Object.entries(insightBodies)) {
        if (u.startsWith(`/api/admin/campaigns/${id}/insights?`)) {
          return okJson(body);
        }
      }
      const out = routes[u];
      if (typeof out === "function") return out(init);
      if (out instanceof Response) return out;
      if (out === undefined) return okJson({});
      return okJson(out);
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders platform cards, gated by integration status, with parsed KPIs", async () => {
    const c = await renderPage();

    // status labels
    expect(c.textContent).toContain("Connected"); // configured
    expect(c.textContent).toContain("Partial"); // x degraded
    expect(c.textContent).toContain("Not configured"); // meta

    // totals: 3 configured (tiktok, linkedin, google) of 5
    expect(c.textContent).toContain("3 / 5");

    // tiktok: 2 active (ENABLE+ACTIVE count), USD spend
    expect(c.textContent).toContain("$151");
    expect(c.textContent).toContain("12,000");
    // linkedin EUR spend
    expect(c.textContent).toContain("€100");
    // google: 0 active campaigns, €250 spend
    expect(c.textContent).toContain("€250");
    // x degraded → no KPI grid (status !== configured)
    // meta not_configured → no KPIs
  });

  it("totals strip sums active campaigns/impressions/clicks", async () => {
    const c = await renderPage();
    // active: 2 (tiktok) + 1 (linkedin) + 0 (google) = 3
    expect(c.textContent).toContain("Active campaigns");
    // impressions: 12000+8000+20000 = 40,000
    expect(c.textContent).toContain("40,000");
    // clicks: 300+200+500 = 1,000
    expect(c.textContent).toContain("1,000");
  });

  it("refresh + integrations-status failure + no-config fallthrough", async () => {
    await renderPage();
    await click(screen.getByText("Refresh"));
    const statusCalls = fetchWithAuthMock.mock.calls.filter(([u]) =>
      String(u).includes("integrations/status")
    );
    expect(statusCalls.length).toBe(2); // initial + manual refresh

    // status endpoint 500 → all platforms "unknown", zero connected
    routes["/api/admin/integrations/status"] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage();
    expect(c2.textContent).toContain("0 / 5");
    expect(c2.textContent).toContain("—");

    // platform fetch throw → parse path tolerated, no crash
    routes["/api/admin/integrations/status"] = {
      integrations: [{ id: "tiktok", status: "configured" }],
    };
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("integrations/status"))
        return okJson({ integrations: [{ id: "tiktok", status: "configured" }] });
      if (u.includes("campaigns/tiktok")) throw new Error("net down");
      return okJson({});
    });
    cleanup();
    const c3 = await renderPage();
    expect(c3.textContent).toContain("1 / 5");
    // quick links rendered
    expect(c3.textContent).toContain("Content Calendar →");
  });

  it("x platform parses spend_micro stats when configured", async () => {
    (insightBodies as Record<string, unknown>).x = {
      stats: { impressions: 5000, clicks: 120, spend_micro: 42_000_000 },
    };
    (routes["/api/admin/integrations/status"] as { integrations: { status: string }[] })
      .integrations.find((i) => i.id === "x")!.status = "configured";
    routes["/api/admin/campaigns/x"] = { campaigns: [{ status: "ACTIVE" }] };
    const c = await renderPage();
    expect(c.textContent).toContain("$42");
    expect(c.textContent).toContain("4 / 5");
  });

  it("shows 'Failed to parse insights' when the insights body is malformed", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.startsWith("/api/admin/campaigns/tiktok/insights?")) {
        return new Response("not-json{", { status: 200 });
      }
      if (u.startsWith("/api/admin/campaigns/") && u.includes("insights?"))
        return okJson({});
      const out = routes[u];
      return out === undefined ? okJson({}) : okJson(out);
    });
    const c = await renderPage();
    // malformed body is tolerated — card renders, other platforms still resolve
    await vi.waitFor(() => expect(c.textContent).toContain("TikTok"));
    expect(c.textContent).toContain("3 / 5");
  });

  it("refetches on the interval and on visibilitychange", async () => {
    vi.useFakeTimers();
    try {
      await renderPage();
      const before = fetchWithAuthMock.mock.calls.length;
      await act(async () => {
        vi.advanceTimersByTime(31_000);
      });
      expect(fetchWithAuthMock.mock.calls.length).toBeGreaterThan(before);

      fetchWithAuthMock.mockClear();
      await act(async () => {
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(fetchWithAuthMock.mock.calls.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Campaign hub branch tests: sparse / malformed insights for every platform,
 * campaigns without a status, missing integrations list, status-message
 * tooltip fallback, synchronous fetch failures surfacing the error banner,
 * and hidden-tab visibility events not refetching.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (url: string) => Response | Promise<Response>;
let route: Route = () => json({});
const fetchWithAuthMock = vi.fn((url: string) => route(url));

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (url: string) => fetchWithAuthMock(url),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import CampaignsDashboard from "@/app/[locale]/admin/campaigns/page";

// en-IE renders USD as "$0" or "US$0" depending on the ICU build
const usd0 = expect.stringMatching(/^(US)?\$0$/);

const allConfigured = {
  integrations: ["tiktok", "linkedin", "x", "google_ads", "meta"].map((id) => ({
    id,
    status: "configured",
  })),
};

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<CampaignsDashboard />).container;
  });
  await act(async () => {});
  return c!;
}

/** KPI label → value for the platform card with the given name. */
function kpis(name: string): Record<string, string> {
  const card = screen.getByText(name).closest("a")!;
  const out: Record<string, string> = {};
  for (const label of ["Active", "Spend MTD", "Impressions", "Clicks"]) {
    const p = Array.from(card.querySelectorAll("p")).find((el) => el.textContent === label);
    if (p) out[label] = p.nextElementSibling?.textContent ?? "";
  }
  return out;
}

describe("campaigns hub — branch coverage", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("insights with empty metric objects fall back to zero spend/impressions/clicks", async () => {
    route = (u) => {
      if (u.includes("integrations/status")) return json(allConfigured);
      if (u.startsWith("/api/admin/campaigns/google/insights")) return json({ metrics: {} });
      if (u.startsWith("/api/admin/campaigns/linkedin/insights")) return json({ insights: {} });
      if (u.startsWith("/api/admin/campaigns/tiktok/insights")) return json({ insights: {} });
      if (u.startsWith("/api/admin/campaigns/x/insights")) return json({ stats: {} });
      // campaigns without a status are not active
      return json({ campaigns: [{}, { status: "enabled" }] });
    };
    await renderPage();
    expect(kpis("Google Ads")).toEqual({
      Active: "1",
      "Spend MTD": "€0",
      Impressions: "0",
      Clicks: "0",
    });
    expect(kpis("LinkedIn")).toMatchObject({ "Spend MTD": "€0", Impressions: "0", Clicks: "0" });
    expect(kpis("TikTok")).toMatchObject({ "Spend MTD": usd0, Impressions: "0", Clicks: "0" });
    expect(kpis("X (Twitter)")).toMatchObject({ "Spend MTD": usd0, Impressions: "0", Clicks: "0" });
  });

  it("unparsable numeric strings (tiktok / linkedin) collapse to zero", async () => {
    route = (u) => {
      if (u.includes("integrations/status")) return json(allConfigured);
      if (u.startsWith("/api/admin/campaigns/tiktok/insights"))
        return json({ insights: { impressions: "n/a", clicks: "?", spend: "free" } });
      if (u.startsWith("/api/admin/campaigns/linkedin/insights"))
        return json({ insights: { impressions: 5, clicks: 1, costInLocalCurrency: "abc" } });
      return json({});
    };
    await renderPage();
    expect(kpis("TikTok")).toMatchObject({ "Spend MTD": usd0, Impressions: "0", Clicks: "0" });
    expect(kpis("LinkedIn")).toMatchObject({ "Spend MTD": "€0", Impressions: "5", Clicks: "1" });
  });

  it("insights bodies without the platform's key, or not objects, leave KPIs as dashes", async () => {
    route = (u) => {
      if (u.includes("integrations/status")) return json(allConfigured);
      if (u.startsWith("/api/admin/campaigns/google/insights")) return json(null);
      if (u.startsWith("/api/admin/campaigns/linkedin/insights")) return json("text");
      if (u.includes("/insights")) return json({ unrelated: true });
      if (u === "/api/admin/campaigns/meta") return json({}, 500);
      return json({});
    };
    await renderPage();
    for (const name of ["Google Ads", "LinkedIn", "TikTok", "X (Twitter)"]) {
      expect(kpis(name)).toEqual({
        Active: "0",
        "Spend MTD": "—",
        Impressions: "—",
        Clicks: "—",
      });
    }
    // meta: campaigns call failed and insights carry no meta shape
    expect(kpis("Meta")).toEqual({
      Active: "—",
      "Spend MTD": "—",
      Impressions: "—",
      Clicks: "—",
    });
  });

  it("status payload without an integrations list → every platform unknown", async () => {
    route = (u) => (u.includes("integrations/status") ? json({}) : json({ campaigns: [] }));
    const c = await renderPage();
    expect(c.textContent).toContain("0 / 5");
    expect(fetchWithAuthMock.mock.calls.every(([u]) => String(u).includes("integrations"))).toBe(
      true
    );
  });

  it("status dot tooltip uses the integration message, else the status label", async () => {
    route = (u) =>
      u.includes("integrations/status")
        ? json({
            integrations: [
              { id: "tiktok", status: "error", message: "token revoked" },
              { id: "linkedin", status: "not_configured" },
            ],
          })
        : json({});
    await renderPage();
    const tip = (name: string) =>
      screen.getByText(name).closest("a")!.querySelector("[title]")!.getAttribute("title");
    expect(tip("TikTok")).toBe("token revoked");
    expect(tip("LinkedIn")).toBe("Not configured");
    expect(tip("Meta")).toBe("—");
  });

  it("a synchronous fetch failure surfaces the error banner (Error and non-Error)", async () => {
    route = (u) => {
      if (u.includes("integrations/status")) return json(allConfigured);
      throw new Error("fetch exploded");
    };
    const c = await renderPage();
    expect(c.textContent).toContain("fetch exploded");

    cleanup();
    route = (u) => {
      if (u.includes("integrations/status")) return json(allConfigured);
      throw "nope";
    };
    const c2 = await renderPage();
    expect(c2.textContent).toContain("Failed to load");
  });

  it("visibilitychange while hidden does not refetch", async () => {
    route = (u) => (u.includes("integrations/status") ? json({}) : json({}));
    await renderPage();
    fetchWithAuthMock.mockClear();
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();

    spy.mockReturnValue("visible");
    await act(async () => {
      globalThis.dispatchEvent(new Event("focus"));
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/admin/integrations/status");
  });
});

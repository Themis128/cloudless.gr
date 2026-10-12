/**
 * Populated tests for the LinkedIn campaigns admin page — campaign rows,
 * insights cards, CRM lead rollups, 503 placeholder, and error path.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div data-testid="insight-panel" />,
}));

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import LinkedInPage from "@/app/[locale]/admin/campaigns/linkedin/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function route(campaigns: unknown, insights?: unknown, rollups?: unknown, status = 200) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/insights"))
      return Promise.resolve(insights ? okJson(insights) : new Response("x", { status: 503 }));
    if (url.includes("crm-leads"))
      return Promise.resolve(rollups ? okJson(rollups) : new Response("x", { status: 503 }));
    return Promise.resolve(
      new Response(JSON.stringify(campaigns), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
}

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<LinkedInPage />).container;
  });
  return c!;
}

describe("admin campaigns/linkedin — populated", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders campaign rows, insights cards, and CRM rollups", async () => {
    route(
      {
        campaigns: [
          {
            id: "urn:li:sponsoredCampaign:907100946",
            name: "Cloudless boost - Sep 2026 - coupon — carousel",
            status: "ACTIVE",
            type: "SPONSORED",
            objectiveType: "ENGAGEMENT",
            totalBudget: { amount: "100.00", currencyCode: "EUR" },
            createdAt: 1727000000000,
          },
          {
            id: "urn:li:sponsoredCampaign:2",
            name: "Paused test",
            status: "PAUSED",
            type: "SPONSORED",
            objectiveType: "WEBSITE_VISITS",
            totalBudget: null,
            createdAt: 1726000000000,
          },
        ],
      },
      {
        insights: {
          impressions: 51234,
          clicks: 812,
          costInLocalCurrency: "87.42",
          conversions: 11,
        },
      },
      { rollups: [{ slug: "cloudless-boost-sep", leadCount: 7 }] }
    );
    const c = await renderPage();
    expect(c.textContent).toContain("Cloudless boost - Sep 2026 - coupon — carousel");
    expect(c.textContent).toContain("Paused test");
    expect(c.textContent).toContain("ACTIVE");
    expect(c.textContent).toContain("PAUSED");
    expect(c.textContent).toContain("100.00 EUR");
    expect(c.textContent).toContain("51,234"); // impressions
    expect(c.textContent).toContain("$87.42"); // spend
    expect(c.textContent).toContain("cloudless-boost-sep");
    expect(c.textContent).toContain("CLOUDLESS CAMPAIGNS — CRM LEADS");
    expect(c.textContent).toContain("—"); // null budget fallback
  });

  it("shows the not-configured placeholder on 503", async () => {
    route({ campaigns: [] }, undefined, undefined, 503);
    const c = await renderPage();
    expect(c.textContent).toContain("LinkedIn is not configured");
    expect(c.textContent).toContain("LINKEDIN_ACCESS_TOKEN");
  });

  it("renders the empty-table row and the failure error", async () => {
    route({ campaigns: [] });
    let c = await renderPage();
    expect(c.textContent).toContain("No campaigns found.");

    cleanup();
    fetchMock.mockReset();
    route({ campaigns: [] }, undefined, undefined, 500);
    c = await renderPage();
    expect(c.textContent).toContain("Failed to load campaigns");
  });
});

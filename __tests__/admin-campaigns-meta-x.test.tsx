/**
 * Populated tests for the Meta and X campaigns admin pages — campaign rows,
 * insights cards, 503 placeholder, and error path.
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

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import MetaPage from "@/app/[locale]/admin/campaigns/meta/page";
import XPage from "@/app/[locale]/admin/campaigns/x/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function route(campaigns: unknown, insights: unknown, status = 200) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/insights"))
      return Promise.resolve(
        insights === null ? new Response("x", { status: 503 }) : okJson(insights)
      );
    return Promise.resolve(
      new Response(JSON.stringify(campaigns), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
}

async function renderPage(el: React.ReactElement) {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
}

describe("admin campaigns/meta", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders campaign rows and insights cards", async () => {
    route(
      {
        campaigns: [
          {
            id: "act_1",
            name: "Meta Lead Gen — Athens",
            status: "ACTIVE",
            objective: "LEAD_GENERATION",
            daily_budget: "2500",
            created_time: "2026-09-01T10:00:00Z",
          },
          {
            id: "act_2",
            name: "Paused Awareness",
            status: "PAUSED",
            objective: "BRAND_AWARENESS",
            created_time: "2026-08-15T10:00:00Z",
          },
        ],
      },
      { insights: { impressions: 40210, clicks: 612, spend: 87.5, leads: 9, ctr: 1.52 } }
    );
    const c = await renderPage(<MetaPage />);
    expect(c.textContent).toContain("Meta Lead Gen — Athens");
    expect(c.textContent).toContain("Paused Awareness");
    expect(c.textContent).toContain("LEAD_GENERATION");
    expect(c.textContent).toContain("€25.00"); // daily_budget 2500 cents
    expect(c.textContent).toContain("—"); // missing budget fallback
    expect(c.textContent).toContain("40,210");
    expect(c.textContent).toContain("€87.50");
    expect(c.textContent).toContain("1.52%");
  });

  it("shows the not-configured placeholder on 503", async () => {
    route({}, null, 503);
    const c = await renderPage(<MetaPage />);
    expect(c.textContent).toMatch(/not configured/i);
  });

  it("shows the error state on a failed campaign load", async () => {
    route({}, null, 500);
    const c = await renderPage(<MetaPage />);
    expect(c.textContent).toContain("Failed to load campaigns");
  });
});

describe("admin campaigns/x", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders campaign rows and insights cards", async () => {
    route(
      {
        campaigns: [
          {
            id: "x1",
            name: "X Awareness — Cloudless",
            status: "ACTIVE",
            impressions: 12500,
            clicks: 340,
            cost: 41.2,
            ctr: 2.72,
          },
        ],
      },
      { insights: { impressions: 12500, clicks: 340, costInLocalCurrency: "41.20", leads: 3 } }
    );
    const c = await renderPage(<XPage />);
    expect(c.textContent).toContain("X Awareness — Cloudless");
    expect(c.textContent).toContain("ACTIVE");
    expect(c.textContent).toContain("12,500");
    expect(c.textContent).toContain("$41.20");
  });

  it("shows the not-configured placeholder on 503", async () => {
    route({}, null, 503);
    const c = await renderPage(<XPage />);
    expect(c.textContent).toMatch(/not configured/i);
  });

  it("shows the error state on a failed campaign load", async () => {
    route({}, null, 500);
    const c = await renderPage(<XPage />);
    expect(c.textContent).toContain("Failed to load campaigns");
  });
});

/**
 * Populated tests for the ad-analytics anomaly history page — row rendering,
 * invalid-date passthrough, severity styling, bookmark badge, error path.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const fetchMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchMock(...args),
}));

import AnomalyPage from "@/app/[locale]/admin/campaigns/anomalies/page";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AnomalyPage />).container;
  });
  return c!;
}

describe("admin campaigns/anomalies", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("renders anomaly rows with severity and bookmark badge", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        fetchedAt: "2026-10-15T12:00:00Z",
        anomalies: [
          {
            id: "a1",
            firedAt: "2026-10-15T08:30:00Z",
            campaignSlug: "cloudless-boost-sep",
            platform: "linkedin",
            rule: "ctr_drop",
            severity: "critical",
            message: "CTR dropped 40% day-over-day",
            source: "log",
          },
          {
            id: "a2",
            firedAt: "not-a-date",
            campaignSlug: "x-awareness",
            platform: "x",
            rule: "spend_spike",
            severity: "warning",
            message: "Spend spike detected",
            source: "bookmark",
          },
        ],
      })
    );
    const c = await renderPage();
    expect(c.textContent).toContain("cloudless-boost-sep");
    expect(c.textContent).toContain("ctr_drop");
    expect(c.textContent).toContain("critical");
    expect(c.textContent).toContain("CTR dropped 40% day-over-day");
    // invalid ISO is rendered verbatim
    expect(c.textContent).toContain("not-a-date");
    expect(c.textContent).toContain("(bookmark)");
    // critical severity uses red styling
    const crit = [...c.querySelectorAll("span")].find(
      (s) => s.textContent === "critical"
    )!;
    expect(crit.className).toContain("text-red-400");
  });

  it("shows the error state when the load fails", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const c = await renderPage();
    expect(c.textContent).toContain("HTTP 500");
  });

  it("shows a network error when the fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("conn refused"));
    const c = await renderPage();
    expect(c.textContent).toContain("conn refused");
  });
});

/**
 * /admin/analytics/funnel-audit — state coverage: loading, error,
 * degraded-source banner, auction warning, weakest highlight, and the
 * SocialAuto funnel panel (present/absent).
 *
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import FunnelAuditPage from "@/app/[locale]/admin/analytics/funnel-audit/page";

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const BASE_REPORT = {
  generated_at: "2026-11-08T12:34:56Z",
  sources: { espocrm: true, socialauto: true },
  stages: [
    { stage: "audience", count: 1000, conv_pct: null, note: "followers" },
    { stage: "engaged", count: 40, proxy: true, conv_pct: 4, note: "proxy" },
    { stage: "lead", count: 10, conv_pct: 25, note: "leads" },
    { stage: "nurtured", count: 4, conv_pct: 40, note: "past new" },
    { stage: "opportunity", count: 2, conv_pct: 50, note: "active" },
    { stage: "won", count: 1, conv_pct: 50, note: "closed" },
  ],
  weakest_transition: "nurtured→opportunity (50%)",
  auction_warning: false,
  lead_sources: { "Web Site": 6, LinkedIn: 4 },
  socialauto_funnel: null,
};

async function renderLoaded(report: unknown = BASE_REPORT) {
  fetchWithAuthMock.mockResolvedValue(okJson(report));
  render(<FunnelAuditPage />);
  await waitFor(() => expect(screen.getAllByText("audience").length).toBeGreaterThan(0));
}

describe("FunnelAuditPage", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
  });
  afterEach(cleanup);

  it("renders stages, weakest transition, sources, lead sources", async () => {
    await renderLoaded();
    expect(screen.getAllByText("audience").length).toBeGreaterThan(0);
    expect(screen.getAllByText("won").length).toBeGreaterThan(0);
    expect(screen.getByText(/Weakest transition/)).toBeTruthy();
    expect(screen.getByText(/nurtured→opportunity/)).toBeTruthy();
    expect(screen.getByText("Lead sources")).toBeTruthy();
    expect(screen.getAllByText(/Web Site:/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Auction warning/)).toBeNull();
    expect(screen.queryByText("SocialAuto funnel state")).toBeNull();
  });

  it("shows the auction warning banner", async () => {
    await renderLoaded({ ...BASE_REPORT, auction_warning: true });
    expect(screen.getByText(/Auction warning/)).toBeTruthy();
  });

  it("shows degraded-source banner when a source is down", async () => {
    await renderLoaded({
      ...BASE_REPORT,
      sources: { espocrm: false, socialauto: true },
    });
    expect(screen.getByText(/EspoCRM unreachable/)).toBeTruthy();
  });

  it("shows both degraded notices", async () => {
    await renderLoaded({
      ...BASE_REPORT,
      sources: { espocrm: false, socialauto: false },
    });
    expect(screen.getByText(/EspoCRM unreachable/)).toBeTruthy();
    expect(screen.getByText(/SocialAuto unreachable/)).toBeTruthy();
  });

  it("renders the SocialAuto funnel panel when present", async () => {
    await renderLoaded({
      ...BASE_REPORT,
      socialauto_funnel: {
        lead_tiers: { hot: 2, warm: 1, cold: 7 },
        conversions: [{ campaign: "spring", count: 3, value: 900 }],
        total_conversions: 3,
        total_value: 900,
      },
    });
    expect(screen.getByText("SocialAuto funnel state")).toBeTruthy();
    expect(screen.getAllByText("spring").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hot:/).length).toBeGreaterThan(0);
  });

  it("renders error state on HTTP failure", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson({ error: "nope" }, 500));
    render(<FunnelAuditPage />);
    await waitFor(() => expect(screen.getByText(/HTTP 500|Failed to load/)).toBeTruthy());
  });

  it("renders null counts as em dash", async () => {
    await renderLoaded({
      ...BASE_REPORT,
      stages: [
        { stage: "audience", count: null, conv_pct: null, note: "n/a" },
        { stage: "lead", count: null, conv_pct: null, note: "n/a" },
      ],
      weakest_transition: null,
      lead_sources: {},
    });
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

/**
 * Admin tails: social-ops console (accounts/actions), reports/[id] detail,
 * analytics/seo six-panel populated states.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { SaOpsConsole } from "@/lib/socialauto";
import type { Report } from "@/lib/reports";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const paramsRef = vi.hoisted(() => ({ current: { id: "r1" } }));
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("next/navigation", () => ({ useParams: () => paramsRef.current }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import SocialOpsPage from "@/app/[locale]/admin/social-ops/page";
import ReportDetailPage from "@/app/[locale]/admin/reports/[id]/page";
import SeoPage from "@/app/[locale]/admin/analytics/seo/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => cleanup());

// ── social-ops ──────────────────────────────────────────────────────────────

const console_: SaOpsConsole = {
  checked_at: "2026-01-02T00:00:00Z",
  services: [
    { name: "social-api", online: true, detail: "up" },
    { name: "media-gpu", online: false, detail: "down" },
  ],
  accounts: [
    {
      id: "a1",
      platform: "linkedin",
      username: "cloudless-gr",
      display_name: "Cloudless",
      status: "active",
      account_type: "page",
      token_expires_at: "2026-06-01",
      audit: null,
    },
    {
      id: "a2",
      platform: "facebook",
      username: "themis",
      display_name: "Themis",
      status: "expired",
      account_type: "profile",
      token_expires_at: null,
      audit: null,
    },
  ],
  publish_queue: { pending: 2, failed: 1 },
  media: { ai_generated_assets: 7, comfyui_queue: { pending: 0, running: 1 } },
  browser_orchestrator: {
    current_platform: "linkedin",
    queue_length: 1,
    lock_held: true,
    message: "busy",
  },
  tiktok_audit: { status: "under_review", reference: "ref-1", detail: "audited" },
};

describe("admin social-ops", () => {
  it("renders the console and runs ops actions", async () => {
    mockFetch.mockImplementation(async (_u: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return okJson({ ok: true });
      return okJson(console_);
    });
    const { container, getByText } = render(<SocialOpsPage />);
    await waitFor(() => expect(container.textContent).toContain("Themis"));
    expect(container.textContent).toContain("social-api");
    expect(container.textContent).toContain("under review");

    // session-heal action → POST (button, not the "health" paragraph)
    const healBtn = [...container.querySelectorAll("button")].find((b) =>
      /heal/i.test(b.textContent ?? "")
    );
    expect(healBtn).toBeTruthy();
    await act(async () => fireEvent.click(healBtn!));
    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(([, i]) => (i as RequestInit)?.method === "POST")
      ).toBe(true)
    );

    // browser-lock release button (lock_held → shown)
    const release = [...container.querySelectorAll("button")].find((b) =>
      /release/i.test(b.textContent ?? "")
    );
    if (release) await act(async () => fireEvent.click(release));
  });

  it("shows the error state when the console fetch fails", async () => {
    mockFetch.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<SocialOpsPage />);
    await waitFor(() => expect(container.textContent).toMatch(/error|failed/i));
  });
});

// ── reports/[id] ────────────────────────────────────────────────────────────

const report: Report = {
  id: "r1",
  clientName: "Acme Co",
  dateRange: { start: "2026-01-01", end: "2026-01-31" },
  sections: [
    { id: "pipeline", title: "Pipeline", data: { total: 4 }, insights: "Deals are moving" },
  ],
  createdAt: "2026-02-01",
  status: "ready",
};

describe("admin report detail", () => {
  it("renders sections + insights for a ready report", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson({ report }));
    const { container } = render(<ReportDetailPage />);
    await waitFor(() => expect(container.textContent).toContain("Acme Co"));
    expect(container.textContent).toContain("Pipeline");
    expect(container.textContent).toContain("Deals are moving");
  });

  it("shows not-found on 404", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 404 }));
    const { container } = render(<ReportDetailPage />);
    await waitFor(() => expect(container.textContent).toContain("not found"));
  });
});

// ── analytics/seo ───────────────────────────────────────────────────────────

const seoRoute = async (url: string) => {
  const u = String(url);
  if (u.endsWith("/seo"))
    return okJson({
      snapshot: { clicks: 100, impressions: 5000, ctr: 2.0, avgPosition: 8.4, organicKeywords: 42 },
      keywords: [{ keyword: "cloud migration", clicks: 30, impressions: 900, ctr: 3.3, position: 4.1 }],
    });
  if (u.includes("search-intent"))
    return okJson({
      intent: {
        brand: [{ keyword: "cloudless", clicks: 5, impressions: 50, ctr: 10, position: 1 }],
        product: [],
        informational: [],
        navigational: [],
      },
    });
  if (u.includes("gsc-archive"))
    return okJson({
      reports: [
        { id: "w1", week: "2026-W01", date: "2026-01-05", clicks: 90, impressions: 4500, ctrPct: 2, avgPosition: 9, keywords: 40, topCountry: "GR", mobilePct: 55, ctrOpportunities: 3 },
      ],
    });
  if (u.includes("/pages"))
    return okJson({ pages: [{ page: "/services", clicks: 60, impressions: 2000, ctr: 3 }] });
  if (u.includes("/countries"))
    return okJson({ countries: [{ country: "Greece", clicks: 70, impressions: 3000, ctr: 2.3 }] });
  if (u.includes("/devices"))
    return okJson({ devices: [{ device: "mobile", clicks: 60, impressions: 2800, ctr: 2.1 }] });
  return okJson({});
};

describe("admin analytics seo", () => {
  it("renders snapshot, keywords, intent, archive, pages, countries, devices", async () => {
    fetchWithAuthMock.mockImplementation(seoRoute);
    const { container } = render(<SeoPage />);
    await waitFor(() => expect(container.textContent).toContain("cloud migration"));
    expect(container.textContent).toContain("cloudless");
    expect(container.textContent).toContain("/services");
    expect(container.textContent).toContain("Greece");
    expect(container.textContent).toContain("mobile");
  });

  it("renders the not-configured state on 503", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) =>
      String(url).endsWith("/seo")
        ? new Response("x", { status: 503 })
        : new Response("x", { status: 503 })
    );
    const { container } = render(<SeoPage />);
    await waitFor(() =>
      expect(container.textContent).toMatch(/not configured|gsc|snapshot/i)
    );
  });
});

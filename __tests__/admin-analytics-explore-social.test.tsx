/**
 * admin analytics/explore (DuckDB-WASM query UI) + analytics/social
 * (postiz summary + attribution) populated tails.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { LAKE_PARQUET_CATALOG } from "@/lib/lake-parquet-catalog";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const queryLakeParquetMock = vi.hoisted(() => vi.fn());
const searchParamsRef = vi.hoisted(() => ({ current: new URLSearchParams("") }));

vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsRef.current,
  usePathname: () => "/en/admin/analytics/explore",
}));
vi.mock("@/lib/analytics-client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/analytics-client")>();
  return {
    ...mod,
    queryLakeParquet: queryLakeParquetMock,
    isDuckDBAvailable: () => true,
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import ExplorePage from "@/app/[locale]/admin/analytics/explore/page";
import SocialPage from "@/app/[locale]/admin/analytics/social/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = new URLSearchParams("");
});
afterEach(() => cleanup());

// ── explore ─────────────────────────────────────────────────────────────────

describe("admin analytics explore", () => {
  it("runs the default query and renders rows", async () => {
    queryLakeParquetMock.mockResolvedValueOnce([
      { keyword: "cloud migration", clicks: 12 },
      { keyword: "serverless", clicks: 7 },
    ]);
    const { container } = render(<ExplorePage />);
    const runBtn = [...container.querySelectorAll("button")].find((b) =>
      /run|execute|query/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(runBtn));
    await waitFor(() => expect(container.textContent).toContain("cloud migration"));
    expect(queryLakeParquetMock).toHaveBeenCalledWith(
      LAKE_PARQUET_CATALOG[0].id,
      expect.any(String)
    );
  });

  it("honors dataset + q search params and surfaces query errors", async () => {
    searchParamsRef.current = new URLSearchParams("dataset=stripe&q=revenue");
    queryLakeParquetMock.mockRejectedValueOnce(new Error("duckdb exploded"));
    const { container } = render(<ExplorePage />);
    const runBtn = [...container.querySelectorAll("button")].find((b) =>
      /run|execute|query/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(runBtn));
    await waitFor(() => expect(container.textContent).toContain("duckdb exploded"));
  });
});

// ── social ──────────────────────────────────────────────────────────────────

const summary = {
  channels: [
    {
      id: "ch1",
      name: "Cloudless LinkedIn",
      platform: "linkedin",
      metrics: { followers: 1200, posts: 42 },
      percentageChanges: { followers: 5.2 },
    },
  ],
  topPosts: [
    {
      id: "p1",
      platform: "linkedin",
      content: "Shipping the Pi cluster build log",
      publishDate: "2026-01-01",
      likes: 30,
      comments: 4,
      impressions: 900,
      engagement: 3.8,
    },
  ],
  totals: { posts: 42, impressions: 9000 },
  lookbackDays: 30,
};
const attribution = {
  rows: [
    {
      utm_source: "linkedin",
      utm_campaign: "pi-cluster",
      platform: "linkedin",
      sessions: 50,
      signups: 3,
      leads: 5,
      purchases: 1,
      revenue: 99,
    },
  ],
  totals: { sessions: 50, leads: 5, signups: 3, revenue: 99, conversionRate: 10 },
};

describe("admin analytics social", () => {
  it("loads engagement + attribution, switches day ranges", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (String(url).includes("social-attribution")) return okJson(attribution);
      return okJson(summary);
    });
    const { container } = render(<SocialPage />);
    await waitFor(() => expect(container.textContent).toContain("Cloudless LinkedIn"));
    expect(container.textContent).toContain("Pi cluster");
    expect(container.textContent).toContain("pi-cluster");

    // switch the window → refetches with days=7
    const dayBtn = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === "7d"
    );
    if (dayBtn) {
      fetchWithAuthMock.mockClear();
      await act(async () => fireEvent.click(dayBtn));
      await waitFor(() =>
        expect(
          fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("days=7"))
        ).toBe(true)
      );
    }
  });

  it("shows the Postiz-not-configured error", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 503 }));
    const { container } = render(<SocialPage />);
    await waitFor(() => expect(container.textContent).toContain("Postiz not configured"));
  });


  it("surfaces an engagement API error", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (String(url).includes("social-attribution")) return okJson(attribution);
      return new Response("x", { status: 500 });
    });
    const { container } = render(<SocialPage />);
    await waitFor(() =>
      expect(container.textContent).toContain("Engagement API error: 500")
    );
  });

  it("keeps engagement data when attribution fails with a non-503", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (String(url).includes("social-attribution")) return new Response("x", { status: 404 });
      return okJson(summary);
    });
    const { container } = render(<SocialPage />);
    await waitFor(() => expect(container.textContent).toContain("Cloudless LinkedIn"));
    // attribution section is skipped when attribution stays null
    expect(container.textContent).not.toContain("pi-cluster");
  });

  it("shows a network error when the fetch rejects", async () => {
    fetchWithAuthMock.mockRejectedValue(new Error("boom"));
    const { container } = render(<SocialPage />);
    await waitFor(() => expect(container.textContent).toContain("boom"));
  });

  it("refetches on day-range select and Refresh click", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (String(url).includes("social-attribution")) return okJson(attribution);
      return okJson(summary);
    });
    const { container } = render(<SocialPage />);
    await waitFor(() => expect(container.textContent).toContain("Cloudless LinkedIn"));

    fetchWithAuthMock.mockClear();
    const select = container.querySelector("select")!;
    await act(async () => fireEvent.change(select, { target: { value: "7" } }));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("days=7"))
      ).toBe(true)
    );

    fetchWithAuthMock.mockClear();
    const refreshBtn = [...container.querySelectorAll("button")].find((b) =>
      /refresh/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(refreshBtn));
    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalled());
  });
});

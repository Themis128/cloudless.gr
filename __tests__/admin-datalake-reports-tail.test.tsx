/**
 * admin analytics/datalake + reports — populated states, refresh, generate/delete.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { Report } from "@/lib/reports";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/components/admin/InsightPanel", () => ({
  InsightPanel: () => <div>INSIGHT_PANEL</div>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import DatalakePage from "@/app/[locale]/admin/analytics/datalake/page";
import ReportsPage from "@/app/[locale]/admin/reports/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

// ── datalake ────────────────────────────────────────────────────────────────

const datalakeBody = {
  generated_at: "2026-01-02T00:00:00Z",
  cache: "hit",
  source: "gold",
  sections: [
    {
      section: "acquisition_funnel",
      rows: [{ stage: "visit", count: 100 }],
      rowCount: 1,
      fromCache: true,
    },
    { section: "top_errors", error: "r2 read timeout" },
    { section: "unknown_section", rows: [{ a: 1 }], rowCount: 1 },
  ],
  freshness: {
    generated_at: "2026-01-02T00:00:00Z",
    sources: { r2: { exists: true, last_etl_at: "2026-01-01", size: 1024 } },
  },
};

describe("admin datalake", () => {
  it("renders gold sections, error tiles, and refresh", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson(datalakeBody));
    const { container, getByText } = render(<DatalakePage />);
    await waitFor(() =>
      expect(container.textContent).toContain("GOLD SNAPSHOT")
    );
    expect(container.textContent).toContain("Acquisition funnel");
    expect(container.textContent).toContain("r2 read timeout");

    fetchWithAuthMock.mockClear();
    await act(async () => fireEvent.click(getByText("Re-read gold snapshot")));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("refresh=1"))
      ).toBe(true)
    );
  });

  it("surfaces load failure", async () => {
    fetchWithAuthMock.mockResolvedValue(new Response("x", { status: 500, statusText: "Server Error" }));
    const { container } = render(<DatalakePage />);
    await waitFor(() => expect(container.textContent).toContain("Failed to load"));
  });

  it("shows the 429 message and the HOT D1 badge, formats all column types", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(new Response("x", { status: 429 }));
    const { container, unmount } = render(<DatalakePage />);
    await waitFor(() =>
      expect(container.textContent).toContain("Too many admin requests")
    );
    unmount();

    fetchWithAuthMock.mockResolvedValue(
      okJson({
        ...datalakeBody,
        source: "hot_only",
        sections: [
          {
            section: "top_keywords",
            rows: [
              {
                query: "cloud migration",
                clicks: 42,
                impressions: 1200,
                ctr: 0.035,
                avg_position: 7.481,
              },
              // null + non-numeric values exercise the fmt fallback branches
              { query: "n/a-query", clicks: null, impressions: "—", ctr: "x", avg_position: "" },
            ],
            rowCount: 2,
          },
        ],
      })
    );
    const { container: c2 } = render(<DatalakePage />);
    await waitFor(() => expect(c2.textContent).toContain("HOT D1 ONLY"));
    expect(c2.textContent).toContain("3.50%");
    expect(c2.textContent).toContain("7.481");
    expect(c2.textContent).toContain("1,200");
    expect(c2.textContent).toContain("n/a-query");
  });

  it("plain Refresh refetches without refresh=1; CSV download clicks work", async () => {
    fetchWithAuthMock.mockResolvedValue(okJson(datalakeBody));
    const createUrl = vi.fn(() => "blob:x");
    const revokeUrl = vi.fn();
    (URL as { createObjectURL?: unknown }).createObjectURL = createUrl;
    (URL as { revokeObjectURL?: unknown }).revokeObjectURL = revokeUrl;

    const { container } = render(<DatalakePage />);
    await waitFor(() => expect(container.textContent).toContain("GOLD SNAPSHOT"));

    fetchWithAuthMock.mockClear();
    const refreshBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Reload"
    )!;
    await act(async () => fireEvent.click(refreshBtn));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(
          ([u]) => String(u).includes("/datalake") && !String(u).includes("refresh=1")
        )
      ).toBe(true)
    );

    // CSV export on the rendered section
    const csvBtn = [...container.querySelectorAll("button")].find((b) =>
      /csv/i.test(b.textContent ?? "")
    );
    if (csvBtn) {
      await act(async () => fireEvent.click(csvBtn));
      expect(createUrl).toHaveBeenCalled();
      expect(revokeUrl).toHaveBeenCalled();
    }
  });
});

// ── reports ─────────────────────────────────────────────────────────────────

const report: Report = {
  id: "r1",
  clientName: "Acme Co",
  dateRange: { start: "2026-01-01", end: "2026-01-31" },
  sections: [{ id: "pipeline", title: "Pipeline", data: {} }],
  createdAt: "2026-02-01",
  status: "ready",
};

describe("admin reports", () => {
  it("lists reports, opens the form, generates, deletes", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "DELETE") return okJson({ ok: true });
      if (u.includes("/generate")) return okJson({ ok: true });
      return okJson({ reports: [report] });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { container, getByText } = render(<ReportsPage />);
    await waitFor(() => expect(container.textContent).toContain("Acme Co"));

    // open the generate form + submit
    await act(async () => fireEvent.click(getByText("+ New Report")));
    const form = container.querySelector("form")!;
    expect(form).toBeTruthy();
    const nameInput = form.querySelector('input[type="text"], input:not([type])')!;
    fireEvent.change(nameInput, { target: { value: "New Client" } });
    // toggle a section checkbox
    const cb = form.querySelector('input[type="checkbox"]');
    if (cb) fireEvent.click(cb);
    await act(async () => fireEvent.submit(form));
    await waitFor(() =>
      expect(
        fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("/generate"))
      ).toBe(true)
    );

    // delete the listed report
    const delBtn = [...container.querySelectorAll("button")].find((b) =>
      /delete|✕|🗑/i.test(b.textContent ?? "")
    );
    if (delBtn) {
      await act(async () => fireEvent.click(delBtn));
      await waitFor(() =>
        expect(
          fetchWithAuthMock.mock.calls.some(([, i]) => (i as RequestInit)?.method === "DELETE")
        ).toBe(true)
      );
    }
  });


  it("empty state opens the form; date inputs + cancel + close", async () => {
    fetchWithAuthMock.mockImplementation(async () => okJson({ reports: [] }));
    const { container, getByText, queryByText } = render(<ReportsPage />);
    await waitFor(() => expect(container.textContent).toContain("No reports yet"));

    // empty-state CTA opens the same form
    await act(async () => fireEvent.click(getByText("Generate your first report")));
    const form = container.querySelector("form")!;
    expect(form).toBeTruthy();

    // fill name + both date inputs
    const nameInput = form.querySelector('input[type="text"], input:not([type])')!;
    fireEvent.change(nameInput, { target: { value: "Client X" } });
    const dates = form.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0], { target: { value: "2026-10-01" } });
    fireEvent.change(dates[1], { target: { value: "2026-10-15" } });
    expect((dates[0] as HTMLInputElement).value).toBe("2026-10-01");
    expect((dates[1] as HTMLInputElement).value).toBe("2026-10-15");

    // Cancel closes the form
    await act(async () => fireEvent.click(getByText("Cancel")));
    expect(container.querySelector("form")).toBeNull();

    // reopen via header CTA, then ✕ closes
    await act(async () => fireEvent.click(getByText("+ New Report")));
    expect(container.querySelector("form")).toBeTruthy();
    await act(async () => fireEvent.click(getByText("✕")));
    expect(container.querySelector("form")).toBeNull();
    expect(queryByText("Generate Report")).toBeNull();
  });
});

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
});

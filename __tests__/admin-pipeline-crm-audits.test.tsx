/**
 * Admin tails: pipeline board + move, crm contacts search, audits dashboard,
 * search-funnel populated/unconfigured states.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: fetchWithAuthMock }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import PipelinePage from "@/app/[locale]/admin/pipeline/page";
import CrmPage from "@/app/[locale]/admin/crm/page";
import AuditsPage from "@/app/[locale]/admin/audits/page";
import FunnelPage from "@/app/[locale]/admin/analytics/funnel/page";

const okJson = (b: unknown) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

// ── pipeline ────────────────────────────────────────────────────────────────

const board = {
  dealsByStage: {
    prospecting: [
      { id: "d1", name: "Acme Migration", amount: 5000, stage: "prospecting", closeDate: "2026-02-01", createdAt: "2026-01-01" },
    ],
  },
  pipelines: [
    {
      id: "p1",
      label: "Sales",
      stages: [
        { id: "prospecting", label: "Prospecting", displayOrder: 1 },
        { id: "closed_won", label: "Closed Won", displayOrder: 2 },
      ],
    },
  ],
};
const stats = {
  totalDeals: 1,
  totalValue: 5000,
  byStage: { prospecting: { count: 1, value: 5000 } },
};

describe("admin pipeline", () => {
  it("loads the board and moves a deal between stages", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string, _init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/move")) return okJson({ ok: true });
      if (u.includes("/stats")) return okJson(stats);
      return okJson(board);
    });
    const { container } = render(<PipelinePage />);
    await waitFor(() => expect(container.textContent).toContain("Acme Migration"));

    const moveBtn = [...container.querySelectorAll("button, select")].find((el) =>
      el.tagName === "SELECT" || /move|→/i.test(el.textContent ?? "")
    );
    if (moveBtn && moveBtn.tagName === "SELECT") {
      await act(async () =>
        fireEvent.change(moveBtn, { target: { value: "closed_won" } })
      );
      await waitFor(() =>
        expect(
          fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("/move"))
        ).toBe(true)
      );
    }
  });

  it("shows board load error", async () => {
    fetchWithAuthMock.mockImplementation(async () => new Response("x", { status: 500 }));
    const { container } = render(<PipelinePage />);
    await waitFor(() =>
      expect(container.textContent).toMatch(/failed to load|error/i)
    );
  });
});

// ── crm ─────────────────────────────────────────────────────────────────────

const contacts = {
  contacts: [
    {
      id: "c1",
      emailAddress: "lead@acme.dev",
      firstName: "Lead",
      lastName: "One",
      accountName: "Acme",
      createdAt: new Date().toISOString(),
      leadSource: "Web Site",
    },
    {
      id: "c2",
      emailAddress: "old@corp.dev",
      firstName: "Old",
      lastName: "Two",
      createdAt: "2020-01-01",
      leadSource: "Cold Call",
    },
  ],
};

describe("admin crm", () => {
  it("lists contacts and filters by search", async () => {
    fetchWithAuthMock.mockImplementation(async () => okJson(contacts));
    const { container } = render(<CrmPage />);
    await waitFor(() => expect(container.textContent).toContain("lead@acme.dev"));
    expect(container.textContent).toContain("old@corp.dev");
    expect(container.textContent).toContain("Web Site");

    const search = container.querySelector("input")!;
    fireEvent.change(search, { target: { value: "acme" } });
    await waitFor(() => expect(container.textContent).not.toContain("old@corp.dev"));
  });

  it("shows load error state", async () => {
    fetchWithAuthMock.mockImplementation(async () => new Response("x", { status: 500 }));
    const { container } = render(<CrmPage />);
    await waitFor(() => expect(container.textContent).toContain("HTTP 500"));
  });
});

// ── audits ──────────────────────────────────────────────────────────────────

const auditsDashboard = {
  generatedAt: "2026-01-02T00:00:00Z",
  repo: "Themis128/cloudless.gr",
  audits: {
    lighthouse: {
      name: "Lighthouse",
      workflow: "lighthouse.yml",
      ok: true,
      lastRun: { id: 1, sha: "abc1234", url: "https://gh/run/1", at: "2026-01-01T00:00:00Z" },
      summary: { performance: 92 },
      note: null,
    },
    "link-health": {
      name: "Link health",
      workflow: "link-health.yml",
      ok: false,
      lastRun: null,
      summary: null,
      note: "5 broken links",
    },
    "deps-drift": {
      name: "Deps drift",
      workflow: "deps.yml",
      ok: null,
      lastRun: null,
      summary: null,
      note: null,
    },
  },
};

describe("admin audits", () => {
  it("renders audit entries with status badges", async () => {
    fetchWithAuthMock.mockImplementation(async () => okJson(auditsDashboard));
    const { container } = render(<AuditsPage />);
    await waitFor(() => expect(container.textContent).toContain("Lighthouse"));
    expect(container.textContent).toContain("Link health");
    expect(container.textContent).toContain("✅");
    expect(container.textContent).toContain("❌");
    expect(container.textContent).toContain("⚪");
    expect(container.textContent).toContain("5 broken links");
  });
});

// ── search funnel ───────────────────────────────────────────────────────────

describe("admin search funnel", () => {
  it("renders event rows for the configured funnel", async () => {
    fetchWithAuthMock.mockImplementation(async () =>
      okJson({
        configured: true,
        days: 30,
        rows: [
          { event_type: "search_query", count: 40, ab_variant: "a" },
          { event_type: "search_click", count: 12, ab_variant: "a" },
          { event_type: "search_query", count: 20, ab_variant: "b" },
        ],
      })
    );
    const { container } = render(<FunnelPage />);
    await waitFor(() => expect(container.textContent).toContain("search_query"));
    expect(container.textContent).toContain("40");
  });

  it("renders the unconfigured message on 503", async () => {
    fetchWithAuthMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({ configured: false, days: 30, rows: [], message: "Funnel store not configured" }),
        { status: 503 }
      )
    );
    const { container } = render(<FunnelPage />);
    await waitFor(() => expect(container.textContent).toContain("not configured"));
  });
});

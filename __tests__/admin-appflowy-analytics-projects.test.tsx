/**
 * admin/appflowy/analytics (KPIs, type bars, top pages/sources, recent
 * events, day-range refetch) and admin/projects (projects+tasks tabs,
 * lazy tasks fetch, status PATCHes).
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const match = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out.clone();
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));

import AppFlowyAnalyticsPage from "@/app/[locale]/admin/appflowy/analytics/page";
import AdminProjectsPage from "@/app/[locale]/admin/projects/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

beforeEach(() => {
  routes = {};
  fetchWithAuthMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/appflowy/analytics", () => {
  it("KPIs + byType bars + top lists + recent events + range switch", async () => {
    routes["/api/admin/appflowy/analytics"] = okJson({
      totalEvents: 100,
      byType: { page_view: 80, form_submit: 15, error: 5 },
      topPages: [
        { page: "/", count: 40 },
        { page: "/blog", count: 20 },
      ],
      topSources: [{ source: "", count: 50 }],
      recentEvents: [
        {
          id: "e1",
          event: "view",
          type: "page_view",
          page: "/",
          source: "g",
          count: 1,
          date: "2026-01-02T10:00:00Z",
          country: "GR",
          metadata: "",
        },
      ],
    });
    const c = await renderPage(<AppFlowyAnalyticsPage />);
    expect(c.textContent).toContain("100");
    expect(c.textContent).toContain("80% of total"); // 80/100
    expect(c.textContent).toContain("Needs attention"); // errors > 0
    expect(c.textContent).toContain("(direct)"); // empty source label
    expect(c.textContent).toContain("Form Submissions");

    // range switch → refetch with days=30
    await click(screen.getByText("30d"));
    const call = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("days=30")
    );
    expect(call).toBeDefined();
  });

  it("error + empty", async () => {
    routes["/api/admin/appflowy/analytics"] = okJson({}, 500);
    const c = await renderPage(<AppFlowyAnalyticsPage />);
    expect(c.textContent).toContain("HTTP 500");

    routes["/api/admin/appflowy/analytics"] = okJson(null);
    cleanup();
    const c2 = await renderPage(<AppFlowyAnalyticsPage />);
    expect(c2.textContent).toContain("No analytics data available");
  });
});

describe("admin/projects", () => {
  const projects = [
    {
      id: "pr1",
      name: "Rebuild",
      status: "In Progress",
      priority: "High",
      type: "Client",
      owner: "themis",
      startDate: "2026-01-01",
      dueDate: "2026-03-01",
      description: "",
      budget: null,
      progress: 55,
      tags: [],
      url: "",
    },
  ];
  const tasks = [
    {
      id: "tk1",
      task: "Ship it",
      status: "To Do",
      priority: "Medium",
      assignee: "themis",
      type: "Feature",
      dueDate: "2026-02-01",
      estimate: "2d",
      project: "",
      tags: [],
      url: "",
    },
  ];

  it("projects tab renders, status PATCH; tasks tab lazy-loads + PATCH", async () => {
    routes["/api/admin/appflowy/projects"] = (_u: string, init?: RequestInit) =>
      init?.method === "PATCH" ? okJson({ ok: true }) : okJson({ projects });
    routes["/api/admin/appflowy/tasks"] = (_u: string, init?: RequestInit) =>
      init?.method === "PATCH" ? okJson({ ok: true }) : okJson({ tasks });
    const c = await renderPage(<AdminProjectsPage />);
    expect(c.textContent).toContain("Rebuild");
    expect(c.textContent).toContain("55%");
    expect(c.textContent).toContain("1 project");

    // tasks NOT fetched yet
    expect(
      fetchWithAuthMock.mock.calls.filter(([u]) => String(u).includes("/tasks")).length
    ).toBe(0);

    // project status PATCH
    fireEvent.change(c.querySelector("select")!, { target: { value: "Completed" } });
    await flush();
    const p1 = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => i?.method === "PATCH" && String(u).includes("projects")
    );
    expect(JSON.parse(String(p1![1].body))).toMatchObject({
      pageId: "pr1",
      status: "Completed",
    });

    // switch to tasks → lazy fetch → render + PATCH
    await click(screen.getByText("tasks"));
    await flush();
    expect(c.textContent).toContain("Ship it");
    expect(c.textContent).toContain("1 task");
    fireEvent.change(c.querySelector("select")!, { target: { value: "Done" } });
    await flush();
    const p2 = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => i?.method === "PATCH" && String(u).includes("tasks")
    );
    expect(JSON.parse(String(p2![1].body))).toMatchObject({
      pageId: "tk1",
      status: "Done",
    });
  });

  it("non-JSON response → descriptive error; empty states", async () => {
    routes["/api/admin/appflowy/projects"] = new Response("<html>nope</html>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
    const c = await renderPage(<AdminProjectsPage />);
    expect(c.textContent).toContain("API route missing");

    routes["/api/admin/appflowy/projects"] = okJson({ projects: [] });
    cleanup();
    const c2 = await renderPage(<AdminProjectsPage />);
    expect(c2.textContent).toContain("No projects in AppFlowy yet");
  });
});

/**
 * admin/projects residual branches: readJson's content-type and error-body
 * fallbacks, payloads missing their list keys, non-Error failures, multi-row
 * status updates (only the edited row changes), blank/unknown field
 * fallbacks, plural footers, the empty tasks state, and Refresh on the
 * projects tab.
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

type Handler = (init?: RequestInit) => Response | Promise<Response>;
let projectsRoute: Handler = () => okJson({ projects: [] });
let tasksRoute: Handler = () => okJson({ tasks: [] });
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) =>
  url.includes("/tasks") ? tasksRoute(init) : projectsRoute(init)
);
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (url: string, init?: RequestInit) => fetchWithAuthMock(url, init),
}));

import AdminProjectsPage from "@/app/[locale]/admin/projects/page";

const project = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Project ${id}`,
  status: "Planning",
  priority: "Low",
  type: "",
  owner: "o",
  startDate: "",
  dueDate: "2026-03-01",
  description: "",
  budget: null,
  progress: 10,
  tags: [],
  url: "",
  ...extra,
});
const task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  task: `Task ${id}`,
  status: "Backlog",
  priority: "Low",
  assignee: "a",
  type: "Bug",
  dueDate: "2026-02-01",
  estimate: "",
  project: "",
  tags: [],
  url: "",
  ...extra,
});

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<AdminProjectsPage />).container;
  });
  return c!;
}
const act$ = async (fn: () => void) => {
  await act(async () => {
    fn();
    await new Promise((r) => setTimeout(r, 0));
  });
};
const rows = (c: HTMLElement) => Array.from(c.querySelectorAll("tbody tr"));
const cellText = (tr: Element) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent);

beforeEach(() => {
  fetchWithAuthMock.mockClear();
  projectsRoute = () => okJson({ projects: [] });
  tasksRoute = () => okJson({ tasks: [] });
});
afterEach(() => cleanup());

describe("readJson error mapping", () => {
  it("a non-404 non-JSON response names the content type and status", async () => {
    projectsRoute = () =>
      new Response("<html/>", { status: 502, headers: { "Content-Type": "text/html" } });
    const c = await renderPage();
    expect(c.textContent).toContain("Expected JSON, got text/html (HTTP 502)");
  });

  it("a response with no content type is reported as unknown", async () => {
    projectsRoute = () => new Response(null, { status: 204 });
    const c = await renderPage();
    expect(c.textContent).toContain("Expected JSON, got unknown (HTTP 204)");
  });

  it("a JSON error without a message, or with an unparseable body, falls back to the status", async () => {
    projectsRoute = () => okJson({}, 500);
    const c = await renderPage();
    expect(c.textContent).toContain("HTTP 500");
    cleanup();
    projectsRoute = () =>
      new Response("{not json", { status: 503, headers: { "Content-Type": "application/json" } });
    const c2 = await renderPage();
    expect(c2.textContent).toContain("HTTP 503");
  });

  it("non-Error rejections use the per-action fallback messages", async () => {
    projectsRoute = () => Promise.reject("boom");
    tasksRoute = () => Promise.reject("boom");
    const c = await renderPage();
    expect(c.textContent).toContain("Failed to load projects");
    await act$(() => fireEvent.click(screen.getByText("tasks")));
    expect(c.textContent).toContain("Failed to load tasks");
  });

  it("non-Error PATCH failures use the update fallback messages", async () => {
    projectsRoute = (init) =>
      init?.method === "PATCH" ? Promise.reject("x") : okJson({ projects: [project("a")] });
    tasksRoute = (init) =>
      init?.method === "PATCH" ? Promise.reject("x") : okJson({ tasks: [task("t")] });
    const c = await renderPage();
    await act$(() =>
      fireEvent.change(c.querySelector("select")!, { target: { value: "On Hold" } })
    );
    expect(c.textContent).toContain("Failed to update project");
    await act$(() => fireEvent.click(screen.getByText("tasks")));
    await act$(() =>
      fireEvent.change(c.querySelector("select")!, { target: { value: "Blocked" } })
    );
    expect(c.textContent).toContain("Failed to update task");
  });
});

describe("tables", () => {
  it("payloads without list keys show the empty states (tasks included)", async () => {
    projectsRoute = () => okJson({});
    tasksRoute = () => okJson({});
    const c = await renderPage();
    expect(c.textContent).toContain("No projects in AppFlowy yet.");
    await act$(() => fireEvent.click(screen.getByText("tasks")));
    expect(c.textContent).toContain("No tasks in AppFlowy yet.");
    expect(screen.getByText("tasks").textContent).toBe("tasks0");
  });

  it("projects: blank fields, unknown status, plural footer, only the edited row updates", async () => {
    projectsRoute = (init) =>
      init?.method === "PATCH"
        ? okJson({ ok: true })
        : okJson({
            projects: [
              project("a", { name: "", owner: "", dueDate: "", status: "Archived" }),
              project("b"),
            ],
          });
    const c = await renderPage();
    const [a, b] = rows(c);
    expect(cellText(a)[0]).toBe("(Untitled)");
    expect(cellText(a)[4]).toBe("—");
    expect(cellText(a)[5]).toBe("—");
    expect(a.querySelector("select")!.className).toContain("border-slate-700 text-slate-400");
    expect(c.textContent).toContain("2 projects");

    await act$(() =>
      fireEvent.change(b.querySelector("select")!, { target: { value: "Completed" } })
    );
    const [a2, b2] = rows(c).map((tr) => tr.querySelector("select") as HTMLSelectElement);
    expect(b2.value).toBe("Completed");
    expect(b2.className).toContain("text-neon-green");
    expect(a2.className).toContain("border-slate-700 text-slate-400");
  });

  it("tasks: blank fields, unknown status, plural footer, only the edited row updates", async () => {
    tasksRoute = (init) =>
      init?.method === "PATCH"
        ? okJson({ ok: true })
        : okJson({
            tasks: [
              task("x", { task: "", assignee: "", type: "", dueDate: "", status: "Icebox" }),
              task("y"),
            ],
          });
    const c = await renderPage();
    await act$(() => fireEvent.click(screen.getByText("tasks")));
    const [x, y] = rows(c);
    expect(cellText(x)).toEqual(["(Untitled)", expect.any(String), "Low", "—", "—", "—"]);
    expect(x.querySelector("select")!.className).toContain("border-slate-700 text-slate-400");
    expect(c.textContent).toContain("2 tasks");

    await act$(() => fireEvent.change(y.querySelector("select")!, { target: { value: "Done" } }));
    const [x2, y2] = rows(c).map((tr) => tr.querySelector("select") as HTMLSelectElement);
    expect(y2.value).toBe("Done");
    expect(x2.className).toContain("border-slate-700 text-slate-400");
  });

  it("Refresh on the projects tab reloads projects, not tasks", async () => {
    const c = await renderPage();
    const before = fetchWithAuthMock.mock.calls.length;
    projectsRoute = () => okJson({ projects: [project("n")] });
    await act$(() => fireEvent.click(screen.getByText("↺ Refresh")));
    const newCalls = fetchWithAuthMock.mock.calls.slice(before).map(([u]) => u);
    expect(newCalls).toEqual(["/api/admin/appflowy/projects"]);
    expect(c.textContent).toContain("Project n");
    expect(c.textContent).toContain("1 project");
  });
});

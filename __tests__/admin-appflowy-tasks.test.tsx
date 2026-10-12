/**
 * Populated-state interaction tests for the AppFlowy tasks kanban page —
 * kanban/list/sprint views, sprint filter chips, bulk status update,
 * create form, per-task status select, overdue badges.
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
  const out = routes[String(url)];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import TasksKanbanPage from "@/app/[locale]/admin/appflowy/tasks/page";

const TASKS = [
  {
    id: "t1",
    task: "Fix login",
    status: "In Progress",
    priority: "Urgent",
    assignee: "themis",
    project: "Site",
    dueDate: "2020-01-01", // overdue (not Done)
    estimate: "2h",
    type: "Bug",
    description: "broke",
    labels: ["hot"],
    sprint: "S1",
    url: "https://x/t1",
  },
  {
    id: "t2",
    task: "Write docs",
    status: "Done",
    priority: "Low",
    assignee: "",
    project: "",
    dueDate: "2020-01-01", // past but Done → not overdue
    estimate: "",
    type: "",
    description: "",
    labels: [],
    sprint: "S1",
    url: "",
  },
  {
    id: "t3",
    task: "Backlog item",
    status: "Backlog",
    priority: "Medium",
    assignee: "",
    project: "",
    dueDate: "2099-01-01",
    estimate: "1d",
    type: "Feature",
    description: "",
    labels: [],
    sprint: undefined,
    url: "",
  },
];

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<TasksKanbanPage />).container;
  });
  return c!;
}
const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("appflowy tasks — populated interactions", () => {
  beforeEach(() => {
    routes = { "/api/admin/appflowy/tasks": { tasks: TASKS } };
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("kanban — columns, task cards, overdue badge, sprint chips + progress", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("Fix login");
    expect(c.textContent).toContain("OVERDUE");
    expect(c.textContent).toContain("Write docs");
    expect(c.textContent).toContain("Backlog item");
    expect(c.textContent).toContain("hot"); // label
    expect(c.textContent).toContain("themis");

    // sprint chips: All(3), S1(2), Overdue(1)
    expect(c.textContent).toContain("All (3)");
    expect(c.textContent).toContain("S1 (2)");
    expect(c.textContent).toContain("Overdue (1)");

    // filter to S1 → progress bar 1/2 = 50%
    await click(screen.getByText("S1 (2)"));
    expect(c.textContent).toContain("1/2 (50%)");
    expect(c.textContent).not.toContain("Backlog item");

    // overdue filter
    await click(screen.getByText("Overdue (1)"));
    expect(c.textContent).toContain("Fix login");
    expect(c.textContent).toContain("1 task in overdue");

    // back to all
    await click(screen.getByText("All (3)"));
    expect(c.textContent).toContain("3 tasks");

    // status change on a card
    routes["/api/admin/appflowy/tasks"] = (init?: RequestInit) =>
      init?.method === "PATCH" ? okJson({}) : okJson({ tasks: TASKS });
    // first column is Backlog → first select belongs to t3's card
    const sel = c.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "Done" } });
    await flush();
    const patch = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch![1].body))).toEqual({ pageId: "t3", status: "Done" });
  });

  it("list view — checkboxes, bulk update, clear; empty-filter", async () => {
    const c = await renderPage();
    await click(screen.getByText("≡ List"));

    // select t1 + t3 via checkboxes
    const boxes = c.querySelectorAll("input[type='checkbox']");
    fireEvent.click(boxes[0]); // t1
    fireEvent.click(boxes[2]); // t3
    await flush();
    expect(c.textContent).toContain("2 selected");

    routes["/api/admin/appflowy/tasks"] = (init?: RequestInit) =>
      init?.method === "PATCH" ? okJson({}) : okJson({ tasks: TASKS });
    // set bulk status then apply
    const bulkBar = screen.getByText("Update All").parentElement!;
    fireEvent.change(bulkBar.querySelector("select")!, { target: { value: "In Review" } });
    await click(screen.getByText("Update All"));
    const patches = fetchWithAuthMock.mock.calls.filter(
      ([, i]) => i?.method === "PATCH" && String(i.body).includes('"In Review"')
    );
    expect(patches.length).toBe(2);
    expect(c.textContent).not.toContain("selected"); // cleared after apply

    // check + clear
    fireEvent.click(c.querySelectorAll("input[type='checkbox']")[0]);
    await flush();
    await click(screen.getByText("Clear"));
    expect(c.textContent).not.toContain("selected");
  });

  it("sprint view — per-sprint cards + unassigned group; empty state", async () => {
    const c = await renderPage();
    await click(screen.getByText("⟳ Sprint"));
    expect(c.textContent).toContain("1/2 done"); // S1
    expect(c.textContent).toContain("No Sprint (1)"); // t3 unassigned

    // no sprints at all
    routes["/api/admin/appflowy/tasks"] = {
      tasks: [TASKS[2]],
    };
    cleanup();
    const c2 = await renderPage();
    await click(screen.getByText("⟳ Sprint"));
    expect(c2.textContent).toContain("No sprints assigned to tasks yet");
  });

  it("create form — fields → POST payload; error + load failure", async () => {
    const c = await renderPage();
    await click(screen.getByText("+ New Task"));
    expect(c.textContent).toContain("Create Task");

    const form = screen.getByText("Create Task").parentElement!;
    fireEvent.change(form.querySelector("input[placeholder='Task title *']")!, {
      target: { value: "New thing" },
    });
    fireEvent.change(form.querySelectorAll("select")[0], { target: { value: "High" } });
    fireEvent.change(form.querySelectorAll("select")[1], { target: { value: "Bug" } });
    fireEvent.change(form.querySelector("input[placeholder='Project']")!, {
      target: { value: "P" },
    });
    fireEvent.change(form.querySelector("input[placeholder='Assignee']")!, {
      target: { value: "me" },
    });
    fireEvent.change(form.querySelector("input[type='date']")!, {
      target: { value: "2027-01-01" },
    });

    routes["/api/admin/appflowy/tasks"] = (init?: RequestInit) =>
      init?.method === "POST" ? okJson({}) : okJson({ tasks: TASKS });
    await click(screen.getByText("Create"));
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(String(post![1].body))).toEqual({
      task: "New thing",
      priority: "High",
      project: "P",
      assignee: "me",
      type: "Bug",
      dueDate: "2027-01-01",
    });
    expect(c.textContent).not.toContain("Create Task"); // closed

    // POST error → stays open
    routes["/api/admin/appflowy/tasks"] = (init?: RequestInit) =>
      init?.method === "POST" ? okJson({}, 500) : okJson({ tasks: TASKS });
    await click(screen.getByText("+ New Task"));
    const f2 = screen.getByText("Create Task").parentElement!;
    fireEvent.change(f2.querySelector("input[placeholder='Task title *']")!, {
      target: { value: "X" },
    });
    await click(screen.getByText("Create"));
    expect(c.textContent).toContain("Create Task"); // still open
    await click(screen.getByText("Cancel"));
    expect(c.textContent).not.toContain("Create Task");

    // load failure
    routes["/api/admin/appflowy/tasks"] = okJson({}, 500);
    cleanup();
    const c3 = await renderPage();
    expect(c3.textContent).toContain("HTTP 500");
  });
});

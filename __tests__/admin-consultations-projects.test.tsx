/**
 * admin/consultations (calendar grid + upcoming list + status pills +
 * notification permission) and admin/appflowy/projects (status chips,
 * PATCH status/progress, create form, overdue badge).
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
  const match = Object.keys(routes).find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out.clone();
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));

import ConsultationsPage from "@/app/[locale]/admin/consultations/page";
import ProjectsPage from "@/app/[locale]/admin/appflowy/projects/page";

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
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/consultations", () => {
  const ROUTE = "/api/admin/consultations";
  const in30 = new Date(Date.now() + 30 * 60_000).toISOString();
  const in3h = new Date(Date.now() + 3 * 3600_000).toISOString();
  const in3d = new Date(Date.now() + 3 * 86400_000).toISOString();

  it("upcoming list renders client names + status pills + meet link", async () => {
    routes[ROUTE] = okJson({
      configured: true,
      consultations: [
        { id: "c1", title: "Cloudless Consultation — Alice", start: in30, end: in3h, meetLink: "https://meet.example/x", status: "upcoming" },
        { id: "c2", title: "Cloudless Consultation — Bob", start: in3d, end: in3d, status: "upcoming" },
        { id: "c3", title: "Old One", start: "2020-01-01T00:00:00Z", end: "2020-01-01T01:00:00Z", status: "past" },
      ],
    });
    const c = await renderPage(<ConsultationsPage />);
    expect(c.textContent).toContain("Upcoming (2)");
    expect(c.textContent).toContain("Alice");
    expect(c.textContent).toContain("Bob");
    expect(c.textContent).not.toContain("Old One"); // past filtered out
    expect(c.textContent).toContain("In 30m"); // ≤60m pill
    expect(c.textContent).toContain("Join Meet");
    // month navigation
    await click(screen.getByText("›"));
    await click(screen.getByText("‹"));
    expect(c.textContent).toContain("CONSULTATIONS");
  });

  it("not configured + notification permission button", async () => {
    routes[ROUTE] = okJson({ configured: false, consultations: [] });
    const c = await renderPage(<ConsultationsPage />);
    expect(c.textContent).toContain("not configured");
    expect(c.textContent).toContain("No upcoming consultations");

    // Notification button when the API exists
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static requestPermission = vi.fn(async () => {
        FakeNotification.permission = "granted";
        return "granted" as NotificationPermission;
      });
    }
    vi.stubGlobal("Notification", FakeNotification);
    cleanup();
    const c2 = await renderPage(<ConsultationsPage />);
    await flush();
    const btn = screen.queryByText("Enable popup notifications");
    if (btn) {
      await click(btn);
      expect(FakeNotification.requestPermission).toHaveBeenCalled();
      await flush();
      expect(c2.textContent).toContain("Popup notifications on");
    }
  });

  it("renders Past and Today pills for edge-case start times", async () => {
    const ago30 = new Date(Date.now() - 30 * 60_000).toISOString();
    const in2h = new Date(Date.now() + 2 * 3600_000).toISOString();
    routes[ROUTE] = okJson({
      configured: true,
      consultations: [
        // status stays "upcoming" server-side even when start slipped past
        { id: "c1", title: "Cloudless Consultation — Late", start: ago30, end: in2h, status: "upcoming" },
        { id: "c2", title: "Cloudless Consultation — Soon", start: in2h, end: in2h, status: "upcoming" },
      ],
    });
    const c = await renderPage(<ConsultationsPage />);
    expect(c.textContent).toContain("Past");
    expect(c.textContent).toContain("Today");
  });

  it("fires booking + reminder notifications when permission is granted", async () => {
    const in10 = new Date(Date.now() + 10 * 60_000).toISOString();
    const in2h = new Date(Date.now() + 2 * 3600_000).toISOString();
    const ctor = vi.fn();
    class FakeNotification {
      static permission: NotificationPermission = "granted";
      constructor(...args: unknown[]) {
        ctor(...args);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);

    let items = [
      { id: "c1", title: "Cloudless Consultation — First", start: in10, end: in2h, status: "upcoming" },
    ];
    // fake timers BEFORE render so the page's poll/reminder intervals are fake
    vi.useFakeTimers();
    try {
      routes[ROUTE] = () => okJson({ configured: true, consultations: items });
      const c = await renderPage(<ConsultationsPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // reminder check runs on mount — in10 is ≤15m away
      expect(ctor).toHaveBeenCalledWith(
        "Consultation starting soon",
        expect.objectContaining({ icon: "/favicon.ico" })
      );

      // the 60s poll re-loads → new booking notification
      ctor.mockClear();
      items = [
        ...items,
        { id: "c2", title: "Cloudless Consultation — Second", start: in2h, end: in2h, status: "upcoming" },
      ];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });
      expect(ctor).toHaveBeenCalledWith(
        "New consultation booked",
        expect.objectContaining({ body: expect.stringContaining("Second") })
      );
      expect(c.textContent).toContain("Upcoming (2)");
    } finally {
      vi.useRealTimers();
    }
  });

  it("wraps the year on January prev and December next", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
      routes[ROUTE] = okJson({ configured: true, consultations: [] });
      const c = await renderPage(<ConsultationsPage />);
      await flush();
      expect(c.textContent).toMatch(/January|Ιανουάριος|Jan/i);
      await click(screen.getByText("‹"));
      expect(c.textContent).toMatch(/December|Δεκέμβριος|Dec/i);
      expect(c.textContent).toContain("2025");

      cleanup();
      vi.setSystemTime(new Date("2026-12-15T12:00:00Z"));
      const c2 = await renderPage(<ConsultationsPage />);
      await flush();
      await click(screen.getByText("›"));
      expect(c2.textContent).toContain("2027");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("admin/appflowy/projects", () => {
  const ROUTE = "/api/admin/appflowy/projects";
  const projects = [
    {
      id: "p1",
      name: "Site rebuild",
      status: "In Progress",
      priority: "High",
      type: "Client",
      owner: "themis",
      startDate: "2026-01-01",
      dueDate: "2020-01-01", // overdue
      description: "rebuild",
      budget: 5000,
      progress: 40,
      tags: ["web"],
      url: "https://appflowy.example/p1",
    },
    {
      id: "p2",
      name: "Ops tooling",
      status: "Planning",
      priority: "Low",
      type: "Internal",
      owner: "",
      startDate: "",
      dueDate: "",
      description: "",
      budget: null,
      progress: 0,
      tags: [],
      url: "",
    },
  ];

  it("list + status PATCH + progress PATCH + create + filter", async () => {
    routes[ROUTE] = okJson({ projects });
    const c = await renderPage(<ProjectsPage />);
    expect(c.textContent).toContain("Site rebuild");
    expect(c.textContent).toContain("OVERDUE"); // due 2020, not completed
    expect(c.textContent).toContain("€5,000");
    expect(c.textContent).toContain("All (2)");
    expect(c.textContent).toContain("In Progress (1)");

    // status change → PATCH {pageId, status}
    const statusSel = c.querySelectorAll("select")[0];
    fireEvent.change(statusSel, { target: { value: "On Hold" } });
    await flush();
    const patch = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch![1].body))).toMatchObject({
      pageId: "p1",
      status: "On Hold",
    });

    // progress input → local change, blur → PATCH {pageId, progress}
    fetchWithAuthMock.mockClear();
    const progInput = c.querySelector("input[type='number']")!;
    fireEvent.change(progInput, { target: { value: "75" } });
    fireEvent.blur(progInput, { target: { value: "75" } });
    await flush();
    const patch2 = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch2![1].body))).toMatchObject({
      pageId: "p1",
      progress: 75,
    });

    // create
    await click(screen.getByText("+ New Project"));
    const nameInput = c.querySelector("input[placeholder='Project name *']")!;
    fireEvent.change(nameInput, { target: { value: "New Proj" } });
    await click(screen.getByText("Create"));
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(String(post![1].body))).toMatchObject({
      name: "New Proj",
      priority: "Medium",
      type: "Internal",
    });

    // filter chip → refetch with status param
    await click(screen.getByText("Completed (0)"));
    const filtered = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("status=Completed")
    );
    expect(filtered).toBeDefined();
  });

  it("error + empty", async () => {
    routes[ROUTE] = okJson({}, 500);
    const c = await renderPage(<ProjectsPage />);
    expect(c.textContent).toContain("HTTP 500");

    routes[ROUTE] = okJson({ projects: [] });
    cleanup();
    const c2 = await renderPage(<ProjectsPage />);
    expect(c2.textContent).toContain("No projects found");
  });
});

describe("admin/appflowy/projects tails", () => {
  const ROUTE = "/api/admin/appflowy/projects";
  const projects = [
    {
      id: "p1",
      name: "Site rebuild",
      status: "In Progress",
      priority: "High",
      type: "Client",
      owner: "themis",
      startDate: "2026-01-01",
      dueDate: "",
      description: "rebuild",
      budget: 5000,
      progress: 40,
      tags: [],
      url: "",
    },
  ];

  it("PATCH failures log without crashing; create form fields propagate", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let failPatch = false;
    routes[ROUTE] = (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH" && failPatch) return okJson({ error: "boom" }, 500);
      if (method === "PATCH") return okJson({ ok: true });
      return okJson({ projects });
    };
    const c = await renderPage(<ProjectsPage />);

    // create form — every field (priority/type/owner/description onChange)
    await click(screen.getByText("+ New Project"));
    fireEvent.change(c.querySelector("input[placeholder='Project name *']")!, {
      target: { value: "Full Form Proj" },
    });
    const selects = Array.from(c.querySelectorAll("select")) as HTMLSelectElement[];
    const prioSel = selects.find((el) => el.value === "Medium")!;
    const typeSel = selects.find((el) => el.value === "Internal")!;
    fireEvent.change(prioSel, { target: { value: "Critical" } });
    fireEvent.change(typeSel, { target: { value: "Maintenance" } });
    fireEvent.change(c.querySelector("input[placeholder='Owner']")!, {
      target: { value: "sofia" },
    });
    fireEvent.change(c.querySelector("textarea[placeholder='Description']")!, {
      target: { value: "desc text" },
    });
    await click(screen.getByText("Create"));
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(String(post![1].body))).toMatchObject({
      name: "Full Form Proj",
      priority: "Critical",
      type: "Maintenance",
      owner: "sofia",
      description: "desc text",
    });

    // status PATCH failure → console.error catch
    failPatch = true;
    const statusSel = c.querySelector("select")!;
    fireEvent.change(statusSel, { target: { value: "On Hold" } });
    await flush();
    expect(errSpy).toHaveBeenCalledWith("Failed to update status:", expect.anything());

    // progress PATCH failure → console.error catch
    const progInput = c.querySelector("input[type='number']")!;
    fireEvent.change(progInput, { target: { value: "80" } });
    fireEvent.blur(progInput);
    await flush();
    expect(errSpy).toHaveBeenCalledWith("Failed to update progress:", expect.anything());
    errSpy.mockRestore();
  });

  it("create failure logs; All filter chip resets status", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    routes[ROUTE] = (url: string, init?: RequestInit) =>
      (init?.method ?? "GET") === "POST"
        ? okJson({ error: "create fail" }, 500)
        : okJson({ projects });
    const c = await renderPage(<ProjectsPage />);
    await click(screen.getByText("+ New Project"));
    fireEvent.change(c.querySelector("input[placeholder='Project name *']")!, {
      target: { value: "X" },
    });
    await click(screen.getByText("Create"));
    await flush();
    expect(errSpy).toHaveBeenCalledWith("Failed to create project:", expect.anything());

    // All chip resets the filter + refetches unfiltered (switch away first)
    await click(screen.getByText(/^Completed \(/));
    fetchWithAuthMock.mockClear();
    await click(screen.getByText(/^All \(/));
    const call = fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes(ROUTE));
    expect(String(call![0])).not.toContain("status=");
    errSpy.mockRestore();
  });
});

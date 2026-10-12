/**
 * admin/calendar (month grid → day click → create form → publish/delete
 * confirms) and admin/cluster (watchdogs table + MQTT chip + Kuma panel +
 * outside-cluster banner).
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
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import CalendarPage from "@/app/[locale]/admin/calendar/page";
import ClusterPage from "@/app/[locale]/admin/cluster/page";

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
  vi.stubGlobal("alert", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/calendar", () => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-15`;
  const item = {
    id: "cal1",
    title: "LinkedIn post",
    type: "social_post",
    platform: "meta",
    status: "draft",
    date: dateStr,
    notes: "",
  };

  it("renders item, publishes via confirm, creates via day-click form", async () => {
    routes["/api/admin/calendar"] = okJson({ items: [item] });
    const c = await renderPage(<CalendarPage />);
    expect(c.textContent).toContain("LinkedIn post");

    // click the item chip (publishable → publish confirm → POST publish → alert)
    await click(screen.getByText("LinkedIn post").closest("div")!);
    const pubCall = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("/publish")
    );
    expect(pubCall).toBeDefined();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining("sent to Postiz")
    );

    // day click opens the form for that date
    const day15 = Array.from(c.querySelectorAll("p")).find((p) => p.textContent === "15")!;
    await click(day15.parentElement!);
    expect(c.textContent).toContain(`New Item — ${dateStr}`);

    // fill + submit → POST /create
    fireEvent.change(c.querySelector("form input")!, { target: { value: "New item" } });
    fireEvent.submit(c.querySelector("form")!);
    await flush();
    const create = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("/create")
    );
    const body = JSON.parse(String(create![1].body));
    expect(body).toMatchObject({ title: "New item", date: dateStr, type: "social_post" });
  });

  it("delete chip + month nav refetches range", async () => {
    routes["/api/admin/calendar"] = okJson({
      items: [{ ...{ id: "cal2", title: "Done item", type: "blog_post", platform: "meta", status: "published", date: dateStr, notes: "" } }],
    });
    const c = await renderPage(<CalendarPage />);
    // non-publishable → delete confirm on chip click
    await click(screen.getByText("Done item").closest("div")!);
    const del = fetchWithAuthMock.mock.calls.find(([u, i]) =>
      i?.method === "DELETE" && String(u).includes("cal2")
    );
    expect(del).toBeDefined();
    expect(c.textContent).not.toContain("Done item");

    // month nav triggers a new from/to fetch
    await click(screen.getByText("›"));
    const navCall = fetchWithAuthMock.mock.calls.findLast(([u]) =>
      String(u).includes("from=")
    );
    expect(navCall).toBeDefined();
  });
});

describe("admin/cluster", () => {
  it("watchdogs table + MQTT chip + kuma grid", async () => {
    routes["/api/admin/cluster/watchdogs"] = okJson({
      fetchedAt: new Date(Date.now() - 120_000).toISOString(),
      watchdogs: [
        {
          name: "kuma-sync",
          namespace: "monitoring",
          schedule: "*/5 * * * *",
          suspended: false,
          lastScheduleTime: new Date(Date.now() - 60_000).toISOString(),
          lastSuccessfulTime: new Date(Date.now() - 60_000).toISOString(),
          lastRunFailed: false,
        },
        {
          name: "disk-check",
          namespace: "monitoring",
          schedule: "0 * * * *",
          suspended: true,
          lastScheduleTime: null,
          lastSuccessfulTime: null,
          lastRunFailed: null,
        },
      ],
    });
    routes["/api/admin/cluster/mqtt-status"] = okJson({
      status: { severity: "warning", count: 3, ts: Math.floor(Date.now() / 1000) - 300 },
    });
    routes["/api/admin/cluster/kuma-status"] = okJson({
      summary: {
        baseUrl: "https://kuma.example",
        slug: "default",
        fetchedAt: "",
        monitors: [
          { id: 1, name: "web", status: "up", pingMs: 20, lastHeartbeatAt: null, groupName: "core" },
          { id: 2, name: "db", status: "down", pingMs: null, lastHeartbeatAt: null, groupName: "core" },
        ],
      },
    });
    const c = await renderPage(<ClusterPage />);
    expect(c.textContent).toContain("kuma-sync");
    expect(c.textContent).toContain("SUSPENDED"); // disk-check
    expect(c.textContent).toContain("WARN (3)"); // MQTT chip
    expect(c.textContent).toContain("web");
    expect(c.textContent).toContain("20ms");
    expect(c.textContent).toContain("2m ago"); // fetchedAt relative
  });

  it("503 → outside-cluster banner; kuma absent → placeholder", async () => {
    routes["/api/admin/cluster/watchdogs"] = okJson({}, 503);
    routes["/api/admin/cluster/mqtt-status"] = okJson({}, 500);
    routes["/api/admin/cluster/kuma-status"] = okJson({ summary: null });
    const c = await renderPage(<ClusterPage />);
    expect(c.textContent).toContain("only renders inside the cluster pod");
    expect(c.textContent).toContain("KUMA_BASE_URL"); // no-summary placeholder
    expect(c.textContent).toContain("—"); // MQTT degraded chip

    routes["/api/admin/cluster/watchdogs"] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage(<ClusterPage />);
    expect(c2.textContent).toContain("HTTP 500");
  });
});

describe("admin/calendar tails", () => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-15`;
  const item = {
    id: "cal1",
    title: "LinkedIn post",
    type: "social_post",
    platform: "meta",
    status: "draft",
    date: dateStr,
    notes: "",
  };

  it("publish failure shows the API error; network failure shows the generic alert", async () => {
    routes["/api/admin/calendar"] = okJson({ items: [item] });
    const c = await renderPage(<CalendarPage />);

    // Non-OK publish → alert with the body error.
    fetchWithAuthMock.mockImplementationOnce(async () => okJson({ error: "postiz down" }, 502));
    await click(screen.getByText("LinkedIn post").closest("div")!);
    expect(window.alert).toHaveBeenCalledWith("postiz down");

    // Thrown fetch → generic failure alert.
    fetchWithAuthMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    await click(screen.getByText("LinkedIn post").closest("div")!);
    expect(window.alert).toHaveBeenCalledWith("Publish failed — could not reach the server.");
    expect(c.textContent).toContain("LinkedIn post");
  });

  it("January prev-month and December next-month wrap the year", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-15T10:00:00"));
      routes["/api/admin/calendar"] = okJson({ items: [] });
      const c = await renderPage(<CalendarPage />);
      expect(c.textContent).toContain("January 2026");
      await click(screen.getByText("‹"));
      expect(c.textContent).toContain("December 2025");
      cleanup();

      vi.setSystemTime(new Date("2026-12-15T10:00:00"));
      const c2 = await renderPage(<CalendarPage />);
      expect(c2.textContent).toContain("December 2026");
      await click(screen.getByText("›"));
      expect(c2.textContent).toContain("January 2027");
    } finally {
      vi.useRealTimers();
    }
  });

  it("form selects + notes update state; cancel buttons close the modal", async () => {
    routes["/api/admin/calendar"] = okJson({ items: [] });
    const c = await renderPage(<CalendarPage />);
    const day15 = Array.from(c.querySelectorAll("p")).find((p) => p.textContent === "15")!;
    await click(day15.parentElement!);

    const selects = c.querySelectorAll("form select");
    fireEvent.change(selects[0]!, { target: { value: "blog_post" } });
    fireEvent.change(selects[1]!, { target: { value: "x" } });
    const notes = c.querySelector("form textarea")!;
    fireEvent.change(notes, { target: { value: "draft notes" } });

    // Cancel button closes without a POST.
    await click(screen.getByText("Cancel"));
    expect(c.querySelector("form")).toBeNull();
    expect(fetchWithAuthMock.mock.calls.some(([u]) => String(u).includes("/create"))).toBe(
      false
    );

    // Reopen + ✕ close.
    await click(day15.parentElement!);
    await click(screen.getByText("✕"));
    expect(c.querySelector("form")).toBeNull();
  });
});

  it("prev-month in a non-January month just decrements", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-15T10:00:00"));
      routes["/api/admin/calendar"] = okJson({ items: [] });
      const c = await renderPage(<CalendarPage />);
      expect(c.textContent).toContain("June 2026");
      await click(screen.getByText("\u2039"));
      expect(c.textContent).toContain("May 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("declining the delete confirm leaves the item in place", async () => {
    const now = new Date();
    const inMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    routes["/api/admin/calendar"] = okJson({
      items: [
        {
          id: "cal9",
          title: "LinkedIn post",
          type: "social_post",
          platform: "meta",
          status: "draft",
          date: inMonth,
          notes: "",
        },
      ],
    });
    const c = await renderPage(<CalendarPage />);
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const del = screen.getByLabelText("Delete LinkedIn post");
    await act(async () => fireEvent.click(del));
    expect(c.textContent).toContain("LinkedIn post");
    expect(
      fetchWithAuthMock.mock.calls.filter(([, i]) => i?.method === "DELETE")
    ).toHaveLength(0);
  });

describe("admin/cluster tails", () => {
  it("status FAILED/PENDING, hour+day relative times, kuma pending, mqtt ok/critical", async () => {
    const twoDays = new Date(Date.now() - 2 * 86_400_000).toISOString();
    routes["/api/admin/cluster/watchdogs"] = okJson({
      fetchedAt: twoDays,
      watchdogs: [
        {
          name: "broken-job",
          namespace: "ns",
          schedule: "* * * * *",
          suspended: false,
          lastScheduleTime: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          lastSuccessfulTime: null,
          lastRunFailed: true,
        },
        {
          name: "never-ran",
          namespace: "ns",
          schedule: "0 0 * * *",
          suspended: false,
          lastScheduleTime: null,
          lastSuccessfulTime: null,
          lastRunFailed: false,
        },
      ],
    });
    routes["/api/admin/cluster/mqtt-status"] = okJson({
      status: { severity: "critical", count: 1 },
    });
    routes["/api/admin/cluster/kuma-status"] = okJson({
      summary: {
        baseUrl: "https://kuma.example",
        slug: "s",
        fetchedAt: twoDays,
        monitors: [
          { id: 3, name: "cron", status: "pending", pingMs: null, lastHeartbeatAt: null, groupName: "g" },
        ],
      },
    });
    const c = await renderPage(<ClusterPage />);
    expect(c.textContent).toContain("FAILED");
    expect(c.textContent).toContain("PENDING");
    expect(c.textContent).toContain("CRITICAL (1)");
    expect(c.textContent).toContain("2d ago"); // fetchedAt
    expect(c.textContent).toContain("3h ago"); // last scheduled
    expect(c.textContent).toContain("cron");

    cleanup();
    routes["/api/admin/cluster/mqtt-status"] = okJson({
      status: { severity: "ok", count: 7 },
    });
    const c2 = await renderPage(<ClusterPage />);
    expect(c2.textContent).toContain("OK (7)");
  });
});

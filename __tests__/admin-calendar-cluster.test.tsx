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

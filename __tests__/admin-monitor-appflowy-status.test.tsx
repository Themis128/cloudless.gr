/**
 * admin/monitor (status+alerts KPIs, pi nodes, esp32 card, active/resolved
 * lists, offline banner) and admin/appflowy/status (db cards, expand,
 * sample table, unauthenticated setup block).
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

import MonitorPage from "@/app/[locale]/admin/monitor/page";
import AppFlowyStatusPage from "@/app/[locale]/admin/appflowy/status/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
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
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/monitor", () => {
  const statusPayload = {
    timestamp: "2026-01-02T00:00:00Z",
    pis: {
      "omv-node": { ip: "192.168.1.200", status: "up", alerts: [] },
      "pi-node": { ip: "192.168.1.128", status: "degraded", alerts: ["HIGH_CPU"] },
    },
    esp32: {
      id: 1,
      ip: "192.168.1.50",
      rssi: -55,
      firmware_ver: "1.2.3",
      uptime_s: 3661,
      free_ram_bytes: 10240,
      last_heartbeat: "2026-01-02T00:00:00Z",
      stale: false,
    },
    alerts: {
      active_count: 1,
      resolved_count: 1,
      total_count: 2,
      by_severity: { critical: 1 },
    },
  };
  const alertsPayload = [
    {
      id: 1,
      code: "DISK_FULL",
      host: "omv",
      service: "disk",
      severity: "critical",
      message: "/var 95%",
      status: "ACTIVE",
      count: 3,
      first_seen: "2026-01-01",
      last_seen: "2026-01-02",
    },
    {
      id: 2,
      code: "TEMP",
      host: "pi",
      service: "sensor",
      severity: "info",
      message: "ok now",
      status: "RESOLVED",
      count: 1,
      first_seen: "2026-01-01",
      last_seen: "2026-01-02",
    },
  ];

  it("renders KPIs, pi nodes, esp32, active + resolved alerts", async () => {
    routes["/api/admin/ops/monitor?resource=status"] = okJson(statusPayload);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson(alertsPayload);
    const c = await renderPage(<MonitorPage />);
    expect(c.textContent).toContain("omv-node");
    expect(c.textContent).toContain("DEGRADED");
    expect(c.textContent).toContain("HIGH_CPU");
    expect(c.textContent).toContain("-55 dBm");
    expect(c.textContent).toContain("1h 1m 1s");
    expect(c.textContent).toContain("10.0 KB");
    expect(c.textContent).toContain("DISK_FULL");
    expect(c.textContent).toContain("Active Alerts (1)");
    expect(c.textContent).toContain("Recently Resolved (1)");
    expect(c.textContent).toContain("TEMP");
  });

  it("offline flag → banner; HTTP error → error box", async () => {
    routes["/api/admin/ops/monitor?resource=status"] = okJson({ offline: true }, 503);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<MonitorPage />);
    expect(c.textContent).toContain("Alert API unreachable");

    routes["/api/admin/ops/monitor?resource=status"] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage(<MonitorPage />);
    expect(c2.textContent).toContain("HTTP 500");
  });

  it("alerts fetch non-OK warns and keeps rendering; WS stream connects/messages/retries", async () => {
    routes["/api/admin/ops/monitor?resource=status"] = okJson(statusPayload);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson({}, 502);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const sockets: Array<{
      onopen: (() => void) | null;
      onmessage: ((e: { data: string }) => void) | null;
      onerror: (() => void) | null;
      onclose: (() => void) | null;
      close: () => void;
    }> = [];
    class FakeWs {
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      close = vi.fn();
      constructor(url: string) {
        expect(url).toContain("esp32-logs");
        sockets.push(this as never);
      }
    }
    vi.stubGlobal("WebSocket", FakeWs);
    vi.useFakeTimers();
    const c = await renderPage(<MonitorPage />);
    expect(sockets.length).toBe(1);
    const ws = sockets[0];
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("alerts fetch returned %d"),
      502
    );

    await act(async () => ws.onopen?.());
    expect(c.textContent).not.toContain("Connecting to log stream");

    // log entries render; ping + non-JSON frames are skipped
    await act(async () => {
      ws.onmessage?.({ data: JSON.stringify({ ts: "2026-01-02T00:00:00Z", level: "error", message: "kernel panic" }) });
      ws.onmessage?.({ data: JSON.stringify({ type: "ping" }) });
      ws.onmessage?.({ data: "garbage{{" });
      ws.onmessage?.({ data: JSON.stringify({ custom: "no-level" }) });
    });
    expect(c.textContent).toContain("kernel panic");
    expect(c.textContent).toContain("ERROR");
    expect(c.textContent).not.toContain("Waiting for log entries");

    // onerror → closed status; onclose → retry schedules a new socket
    await act(async () => ws.onerror?.());
    await act(async () => ws.onclose?.());
    expect(c.textContent).toContain("Log stream disconnected");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
    warn.mockRestore();
  });
});

describe("admin/appflowy/status", () => {
  it("authenticated → db cards auto-expand + sample table + not-configured hint", async () => {
    routes["/api/admin/appflowy/status"] = okJson({
      authenticated: true,
      botName: "cloudless-bot",
      databases: [
        {
          name: "Blog",
          configured: true,
          connected: true,
          count: 7,
          sample: [
            { id: "r1", title: "Post One", published: true, tags: ["a", "b"], missing: null },
          ],
        },
        {
          name: "Tasks",
          configured: false,
          connected: false,
          count: 0,
          sample: [],
          error: "db id missing",
        },
        {
          name: "Docs",
          configured: true,
          connected: true,
          count: 0,
          sample: [],
        },
      ],
    });
    const c = await renderPage(<AppFlowyStatusPage />);
    expect(c.textContent).toContain("Connected as cloudless-bot");
    expect(c.textContent).toContain("Post One"); // auto-expanded connected db
    expect(c.textContent).toContain("7 rows loaded");
    expect(c.textContent).toContain("Showing first 5 rows");
    expect(c.textContent).toContain("db id missing");
    // Docs connected but empty → "no rows yet" (auto-expanded)
    expect(c.textContent).toContain("no rows yet");

    // toggle the unconfigured card → hint appears
    await click(screen.getByText("Tasks"));
    expect(c.textContent).toContain("APPFLOWY_TASKS_DB");

    // summary counts
    expect(c.textContent).toContain("Connected");
  });

  it("unauthenticated → setup instructions; HTTP error → retry", async () => {
    routes["/api/admin/appflowy/status"] = okJson({
      authenticated: false,
      error: "bad token",
      databases: [],
    });
    const c = await renderPage(<AppFlowyStatusPage />);
    expect(c.textContent).toContain("Not Authenticated");
    expect(c.textContent).toContain("bad token");
    expect(c.textContent).toContain("Setup Instructions");

    routes["/api/admin/appflowy/status"] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage(<AppFlowyStatusPage />);
    expect(c2.textContent).toContain("HTTP 500");
    // retry button re-fetches
    await click(screen.getByText("Retry"));
    expect(
      fetchWithAuthMock.mock.calls.filter(([u]) => String(u).includes("appflowy/status"))
        .length
    ).toBeGreaterThanOrEqual(2);
  });
});

/**
 * admin/esp32 — hardware card, ESP32-filtered alerts, RSSI bar, log-filter
 * chips, offline banner.
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

import Esp32Page from "@/app/[locale]/admin/esp32/page";

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

describe("admin/esp32", () => {
  const esp32 = {
    id: 1,
    ip: "192.168.1.50",
    rssi: -55,
    firmware_ver: "1.2.3",
    uptime_s: 90061, // 1d 1h 1m
    free_ram_bytes: 10240,
    last_heartbeat: "2026-01-02T00:00:00Z",
    started_at: "2026-01-01T00:00:00Z",
    device_id: "esp32-abcd",
    stale: false,
  };
  const alerts = [
    {
      id: 1,
      code: "ESP32_OFFLINE",
      host: "esp32",
      service: "hb",
      severity: "high",
      message: "missed heartbeats",
      status: "ACTIVE",
      count: 2,
      first_seen: "2026-01-01",
      last_seen: "2026-01-02",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: 2,
      code: "PI_DISK",
      host: "omv", // filtered OUT — not esp32
      service: "disk",
      severity: "critical",
      message: "full",
      status: "ACTIVE",
      count: 1,
      first_seen: "2026-01-01",
      last_seen: "2026-01-02",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: 3,
      code: "ESP32_TEMP",
      host: "esp32",
      service: "sensor",
      severity: "info",
      message: "recovered",
      status: "RESOLVED",
      count: 1,
      first_seen: "2026-01-01",
      last_seen: "2026-01-02",
      resolved_at: "2026-01-02",
      resolved_by: "auto",
    },
  ];

  it("hardware card + filtered alerts + RSSI + log filter chips", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson(esp32);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson(alerts);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("LIVE");
    expect(c.textContent).toContain("192.168.1.50");
    expect(c.textContent).toContain("1d 1h 1m"); // uptime
    expect(c.textContent).toContain("-55 dBm");
    expect(c.textContent).toContain("esp32-abcd");
    // only esp32 alerts: 1 active + 1 resolved; PI_DISK filtered out
    expect(c.textContent).toContain("Active Alerts (1)");
    expect(c.textContent).toContain("ESP32_OFFLINE");
    expect(c.textContent).not.toContain("PI_DISK");
    expect(c.textContent).toContain("Resolved (1)");
    // log filter chips
    await click(screen.getByText("ERROR"));
    expect(c.textContent).toContain("0 lines");
  });

  it("offline + error + stale badge + low-RAM red", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson({ offline: true }, 503);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("Alert API unreachable");

    routes["/api/admin/ops/monitor?resource=esp32"] = okJson({
      ...esp32,
      stale: true,
      free_ram_bytes: 30000, // < 60000 → red
    });
    cleanup();
    const c2 = await renderPage(<Esp32Page />);
    expect(c2.textContent).toContain("STALE");
    expect(c2.textContent).toContain("29.3 KB");

    routes["/api/admin/ops/monitor?resource=esp32"] = okJson({}, 500);
    cleanup();
    const c3 = await renderPage(<Esp32Page />);
    expect(c3.textContent).toContain("HTTP 500");
  });
});

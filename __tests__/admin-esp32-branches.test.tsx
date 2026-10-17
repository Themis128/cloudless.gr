/**
 * admin/esp32 — branch tails: RSSI colour bands, sub-day uptime, unknown
 * severities/levels, unreadable error bodies, non-Error failures, failed
 * alert fetches and WebSocket frame fallbacks.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
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
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const base = {
  id: 1,
  ip: null,
  rssi: -70,
  firmware_ver: null,
  uptime_s: 3661,
  free_ram_bytes: null,
  last_heartbeat: null,
  started_at: null,
  device_id: null,
  stale: false,
};

const alert = (over: Record<string, unknown>) => ({
  id: 1,
  code: "ESP32_X",
  host: "esp32",
  service: "s",
  severity: "info",
  message: "m",
  status: "ACTIVE",
  count: 1,
  first_seen: "2026-01-01",
  last_seen: "2026-01-02",
  resolved_at: null,
  resolved_by: null,
  ...over,
});

type Sock = {
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
};

function stubWs(): Sock[] {
  const sockets: Sock[] = [];
  class FakeWs {
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    close = vi.fn();
    constructor() {
      sockets.push(this);
    }
  }
  vi.stubGlobal("WebSocket", FakeWs);
  return sockets;
}

const rssiFill = (c: HTMLElement) => c.querySelector<HTMLElement>("div[style*='width']")!;

describe("admin/esp32 branch tails", () => {
  it("sparse status: sub-day uptime, dashes, mid-band RSSI and no device ID", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson(base);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("1h 1m 1s");
    expect(c.textContent).not.toContain("Device ID");
    expect(c.textContent).toContain("-70 dBm");
    const fill = rssiFill(c);
    expect(fill.className).toContain("bg-yellow-400");
    expect(fill.style.width).toBe("33%");
    // Footer has no heartbeat to show.
    expect(c.textContent).toMatch(/Last fetched:\s*—/);
  });

  it("weak RSSI is drawn red", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson({ ...base, rssi: -85 });
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    const fill = rssiFill(c);
    expect(fill.className).toContain("bg-red-400");
    expect(fill.style.width).toBe("8%");
  });

  it("unknown alert severity falls back to the info palette and a slate dot", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson(base);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([alert({ severity: "weird" })]);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("Active Alerts (1)");
    const card = screen.getByText("ESP32_X").closest("div.rounded-xl") as HTMLElement;
    expect(card.className).toContain("text-neon-cyan");
    expect(card.querySelector(".bg-slate-500")).not.toBeNull();
  });

  it("a failed alerts fetch keeps the hardware card and shows no alerts", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson(base);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson({ error: "x" }, 500);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("ESP32 Alert Manager");
    expect(c.textContent).toContain("Active Alerts (0)");
    expect(c.textContent).not.toContain("✗");
  });

  it("an unreadable error body still reports the HTTP status", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = new Response("<html>bad gateway", {
      status: 502,
    });
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("✗ HTTP 502");
    expect(c.textContent).not.toContain("Alert API unreachable");
  });

  it("a non-Error rejection shows the generic failure message", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = () => Promise.reject("socket hang up");
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    expect(c.textContent).toContain("✗ Failed to load");
  });

  it("WebSocket frames: field fallbacks, historic dimming, unknown level colour, 200-line cap", async () => {
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson(base);
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const sockets = stubWs();
    const c = await renderPage(<Esp32Page />);
    const ws = sockets[0];
    await act(async () => ws.onopen?.());
    expect(c.textContent).toContain("Waiting for log entries…");

    await act(async () => {
      ws.onmessage?.({ data: JSON.stringify({ foo: "bar" }) });
      ws.onmessage?.({
        data: JSON.stringify({ id: 9, level: "trace", message: "old line", historic: true }),
      });
    });
    expect(c.textContent).toContain("2 lines");
    // No level → INFO; no message → the raw frame is shown.
    const raw = screen.getByText('{"foo":"bar"}');
    expect(raw.previousElementSibling?.textContent).toBe("INFO");
    expect(raw.parentElement?.className).not.toContain("opacity-50");
    const old = screen.getByText("old line");
    expect(old.parentElement?.className).toContain("opacity-50");
    expect(old.previousElementSibling?.textContent).toBe("TRACE");
    expect(old.previousElementSibling?.className).toContain("text-slate-400");

    await act(async () => {
      for (let i = 0; i < 200; i++) {
        ws.onmessage?.({ data: JSON.stringify({ id: 100 + i, message: `line-${i}` }) });
      }
    });
    expect(c.textContent).toContain("200 lines");
    expect(c.textContent).not.toContain('{"foo":"bar"}');
    expect(c.textContent).toContain("line-199");
  });
});

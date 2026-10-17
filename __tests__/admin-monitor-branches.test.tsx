/**
 * admin/monitor residual branches (LAN host, so the log stream is enabled):
 * sparse/unknown status values, non-JSON or non-Error failures, non-array
 * alerts, unknown severities, resolved-list truncation, log-buffer cap and
 * level fallbacks, and the WebSocket retry cap after repeated closes.
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

const fetchWithAuthMock = vi.fn();
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (url: string) => fetchWithAuthMock(url),
}));

import MonitorPage from "@/app/[locale]/admin/monitor/page";

type Sock = {
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: () => void;
};
let sockets: Sock[] = [];
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

function serve(status: Response | (() => Response | Promise<Response>), alerts: unknown = []) {
  fetchWithAuthMock.mockImplementation(async (url: string) => {
    if (url.endsWith("resource=status"))
      return typeof status === "function" ? status() : status.clone();
    return okJson(alerts);
  });
}

const baseStatus = (over: Record<string, unknown> = {}) => ({
  timestamp: "2026-01-02T00:00:00Z",
  pis: { "odd-node": { ip: "10.0.0.9", status: "rebooting", alerts: [] } },
  esp32: {
    id: 1,
    ip: null,
    rssi: null,
    firmware_ver: null,
    uptime_s: null,
    free_ram_bytes: null,
    last_heartbeat: null,
    stale: true,
  },
  alerts: { active_count: 0, resolved_count: 0, total_count: 0, by_severity: { high: 2 } },
  ...over,
});

const alert = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  code: `CODE_${id}`,
  host: "h",
  service: "s",
  severity: "info",
  message: "m",
  status: "RESOLVED",
  count: 1,
  first_seen: "2026-01-01",
  last_seen: "2026-01-02",
  ...extra,
});

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<MonitorPage />).container;
  });
  return c!;
}
const field = (label: string) => screen.getByText(label).nextElementSibling!.textContent;

beforeEach(() => {
  sockets = [];
  fetchWithAuthMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("WebSocket", FakeWs);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("admin/monitor — status rendering fallbacks", () => {
  it("null ESP32 fields show dashes; stale ESP32, unknown Pi status and high-only severities", async () => {
    serve(okJson(baseStatus()), []);
    const c = await renderPage();
    for (const label of ["IP", "Firmware", "RSSI", "Uptime", "Free RAM", "Last HB"]) {
      expect(field(label)).toBe("—");
    }
    expect(field("ESP32")).toBe("Stale");
    expect(c.textContent).toContain("STALE");
    expect(field("Critical / High")).toBe("2");
    const active = screen.getByText("Active Alerts");
    expect(active.nextElementSibling!.className).toContain("text-neon-green");
    const node = screen.getByText("odd-node").parentElement!;
    expect(node.querySelector("span")!.className).toContain("bg-slate-600");
    expect(screen.getByText("REBOOTING").className).toContain("text-slate-400");
    // alerts endpoint returned an empty list → all clear, no resolved section
    expect(c.textContent).toContain("All Clear");
    expect(c.textContent).not.toContain("Recently Resolved");
  });

  it("a non-array alerts payload is treated as no alerts", async () => {
    serve(okJson(baseStatus()), { alerts: [alert(1, { status: "ACTIVE" })] });
    const c = await renderPage();
    expect(c.textContent).toContain("Active Alerts (0)");
    expect(c.textContent).not.toContain("CODE_1");
  });

  it("unknown severities use the info palette and a grey dot; resolved list shows 10", async () => {
    const alerts = [
      alert(100, { status: "ACTIVE", severity: "mystery" }),
      ...Array.from({ length: 12 }, (_, i) => alert(i + 1)),
    ];
    serve(
      okJson(
        baseStatus({
          alerts: { active_count: 1, resolved_count: 12, total_count: 13, by_severity: {} },
        })
      ),
      alerts
    );
    const c = await renderPage();
    const card = screen.getByText("CODE_100").closest("div.rounded-xl")!;
    expect(card.className).toContain("text-neon-cyan");
    expect(card.querySelector("span")!.className).toContain("bg-slate-500");
    expect(field("Critical / High")).toBe("0");
    expect(screen.getByText("Active Alerts").nextElementSibling!.className).toContain(
      "text-red-400"
    );
    expect(c.textContent).toContain("Recently Resolved (12)");
    expect(c.textContent).toContain("CODE_10");
    expect(c.textContent).not.toContain("CODE_11");
  });
});

describe("admin/monitor — failures", () => {
  it("a non-JSON error body without an offline flag reports the HTTP status", async () => {
    serve(new Response("<html>bad gateway</html>", { status: 502 }));
    const c = await renderPage();
    expect(c.textContent).toContain("✗ HTTP 502");
    expect(c.textContent).not.toContain("Alert API unreachable");
  });

  it("a non-Error rejection shows the generic message; refresh recovers", async () => {
    serve(() => Promise.reject("socket hang up"));
    const c = await renderPage();
    expect(c.textContent).toContain("✗ Failed to load");
    serve(okJson(baseStatus()), []);
    await act(async () => {
      fireEvent.click(screen.getByText("↺ Refresh"));
    });
    expect(c.textContent).not.toContain("Failed to load");
    expect(c.textContent).toContain("odd-node");
  });
});

describe("admin/monitor — log stream", () => {
  it("caps the buffer at 150 lines and falls back for missing ts/level", async () => {
    serve(okJson(baseStatus()), []);
    const c = await renderPage();
    const ws = sockets[0];
    await act(async () => ws.onopen?.());
    await act(async () => {
      for (let i = 0; i < 151; i += 1) {
        ws.onmessage?.({
          data: JSON.stringify({ ts: "2026-01-02T00:00:00Z", level: "info", message: `line-${i}` }),
        });
      }
      ws.onmessage?.({ data: JSON.stringify({ level: "trace", message: "odd level" }) });
    });
    expect(c.textContent).toContain("connected (150 lines)");
    expect(screen.queryByText("line-0")).toBeNull();
    expect(screen.queryByText("line-1")).toBeNull();
    expect(screen.getByText("line-2")).toBeTruthy();
    const odd = screen.getByText("odd level").previousElementSibling!;
    expect(odd.textContent).toBe("TRACE");
    expect(odd.className).toContain("text-slate-400");
  });

  it("stops reconnecting after 10 consecutive closes", async () => {
    vi.useFakeTimers();
    serve(okJson(baseStatus()), []);
    const c = await renderPage();
    for (let i = 0; i < 10; i += 1) {
      await act(async () => sockets.at(-1)!.onclose?.());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });
    }
    // 1 initial socket + 9 reconnects; the 10th close hits the cap
    expect(sockets).toHaveLength(10);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(sockets).toHaveLength(10);
    expect(c.textContent).toContain("Log stream disconnected — retrying…");
  });
});

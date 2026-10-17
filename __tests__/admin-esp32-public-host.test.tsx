/**
 * admin/esp32 on the public deployment (cloudless.gr): no WebSocket is
 * opened and the stream panel explains why.
 *
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://cloudless.gr/en/admin/esp32"}
 */
import { act, cleanup, render } from "@testing-library/react";
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

describe("admin/esp32 public host", () => {
  it("skips the WebSocket and labels the stream unavailable", async () => {
    const ctor = vi.fn();
    vi.stubGlobal("WebSocket", ctor);
    routes["/api/admin/ops/monitor?resource=esp32"] = okJson({
      id: 1,
      ip: "10.0.0.2",
      rssi: null,
      firmware_ver: "2.0",
      uptime_s: null,
      free_ram_bytes: 70000,
      last_heartbeat: null,
      started_at: null,
      device_id: null,
      stale: false,
    });
    routes["/api/admin/ops/monitor?resource=alerts"] = okJson([]);
    const c = await renderPage(<Esp32Page />);
    expect(window.location.hostname).toBe("cloudless.gr");
    expect(ctor).not.toHaveBeenCalled();
    expect(c.textContent).toContain("WebSocket unavailable on this deployment");
    expect(c.textContent).toContain("WebSocket stream not available on this deployment.");
    expect(c.textContent).not.toContain("WebSocket reconnects automatically");
  });
});

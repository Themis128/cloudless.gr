// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/admin/esp32 tails: status payloads with neither device_id nor id,
 * explicit stale flags, and admin auth on POST and PUT.
 */

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", () => ({ requireAdmin }));

const fetchMock = vi.fn();

async function loadRoute() {
  vi.resetModules();
  vi.stubEnv("ALERT_API_URL", "https://alert-api.example.test");
  return import("@/app/api/admin/esp32/route");
}

const req = (path: string, init?: { method?: string; body?: string }) =>
  new NextRequest(new URL(path, "https://cloudless.gr"), init);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ ok: true });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET ?action=devices status mapping", () => {
  it("names the device esp32-unknown when status has neither device_id nor id", async () => {
    const route = await loadRoute();
    fetchMock.mockResolvedValueOnce(json({ device_id: "", stale: false }));
    const res = await route.GET(req("/api/admin/esp32?action=devices"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        device_id: "esp32-unknown",
        ip: null,
        rssi: null,
        firmware_ver: null,
        uptime_s: null,
        free_ram_bytes: null,
        last_heartbeat: null,
        stale: false,
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://alert-api.example.test/api/esp32/status");
  });

  it("passes an explicit stale=true through and defaults a non-boolean stale to true", async () => {
    const route = await loadRoute();
    fetchMock.mockResolvedValueOnce(json({ device_id: "esp32-a", stale: true }));
    expect((await (await route.GET(req("/api/admin/esp32?action=devices"))).json())[0].stale).toBe(
      true
    );
    fetchMock.mockResolvedValueOnce(json({ device_id: "esp32-a", stale: "no" }));
    expect((await (await route.GET(req("/api/admin/esp32?action=devices"))).json())[0].stale).toBe(
      true
    );
  });
});

describe("admin auth on writes", () => {
  it("POST returns the auth response and never proxies when not admin", async () => {
    const route = await loadRoute();
    requireAdmin.mockResolvedValueOnce({
      ok: false,
      response: new Response("forbidden", { status: 403 }),
    });
    const res = await route.POST(
      req("/api/admin/esp32?action=command", { method: "POST", body: '{"action":"reboot"}' })
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PUT returns the auth response and never proxies when not admin", async () => {
    const route = await loadRoute();
    requireAdmin.mockResolvedValueOnce({
      ok: false,
      response: new Response("unauthorized", { status: 401 }),
    });
    const res = await route.PUT(
      req("/api/admin/esp32?device_id=d1", { method: "PUT", body: "{}" })
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

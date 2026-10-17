/**
 * esp32-manager branch tails: byte-sized RAM, singular device count, RSSI
 * colour bands, feedback auto-clear timers, cancelled reboot, failed config
 * save, and OTA without a version.
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
  const out = routes[url];
  if (typeof out === "function") return out(init);
  if (out instanceof Response) return out;
  if (out === undefined) return okJson(null);
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

import Esp32ManagerPage from "@/app/[locale]/admin/esp32-manager/page";

const DEVICE = {
  device_id: "esp32-leds",
  ip: "192.168.1.50",
  rssi: -65,
  firmware_ver: "4.0",
  uptime_s: 600,
  free_ram_bytes: 512,
  last_heartbeat: "2026-01-01T10:00:00Z",
  stale: false,
};
const CONFIG_URL = "/api/admin/esp32?action=config&device_id=esp32-leds";
const CMD_URL = "/api/admin/esp32?action=command&device_id=esp32-leds";

async function renderPage() {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(<Esp32ManagerPage />).container;
  });
  return c!;
}

const click = async (el: Element | null) => {
  await act(async () => fireEvent.click(el!));
};

const rssiFill = (c: HTMLElement) => c.querySelector<HTMLElement>("div[style*='width']")!;

describe("esp32-manager — branch tails", () => {
  beforeEach(() => {
    routes = { "/api/admin/esp32?action=devices": [DEVICE] };
    fetchWithAuthMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.unstubAllGlobals();
  });

  it("one device: singular count, byte-sized RAM and an amber mid-strength RSSI bar", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("1 device registered");
    expect(c.textContent).toContain("512 B");
    expect(c.textContent).toContain("10m");
    const fill = rssiFill(c);
    expect(fill.className).toContain("bg-amber-500");
    expect(fill.style.width).toBe("50%");
  });

  it("weak RSSI is drawn red", async () => {
    routes["/api/admin/esp32?action=devices"] = [{ ...DEVICE, rssi: -90 }];
    const c = await renderPage();
    const fill = rssiFill(c);
    expect(fill.className).toContain("bg-red-500");
    expect(parseFloat(fill.style.width)).toBeCloseTo((10 / 70) * 100, 5);
  });

  it("LED feedback clears after 3.5s; a declined reboot sends nothing", async () => {
    vi.useFakeTimers();
    routes[CMD_URL] = { ok: true };
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmMock);
    const c = await renderPage();
    await click(screen.getByText("LED Control"));

    await click(screen.getByText("⚠ Reboot device"));
    expect(confirmMock).toHaveBeenCalledWith("Reboot esp32-leds?");
    expect(fetchWithAuthMock.mock.calls.some(([u]) => String(u) === CMD_URL)).toBe(false);

    await click(screen.getByText("Critical"));
    expect(c.textContent).toContain("✓ led_mode sent");
    await act(async () => {
      vi.advanceTimersByTime(3499);
    });
    expect(c.textContent).toContain("✓ led_mode sent");
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(c.textContent).not.toContain("✓ led_mode sent");
  });

  it("a failed config save keeps the form dirty and the message clears after 4s", async () => {
    vi.useFakeTimers();
    routes[CONFIG_URL] = (init?: RequestInit) =>
      init?.method === "PUT"
        ? okJson({ offline: true })
        : okJson({
            device_id: "esp32-leds",
            brightness: 10,
            heartbeat_interval_s: 60,
            mqtt_qos: 0,
          });
    const c = await renderPage();
    await click(screen.getByText("Config"));
    fireEvent.change(c.querySelector("input[type='number']")!, { target: { value: "90" } });
    const save = screen.getByText("Save & publish to device") as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await click(save);
    expect(c.textContent).toContain("✗ Save failed");
    // Still dirty → the user can retry.
    expect((screen.getByText("Save & publish to device") as HTMLButtonElement).disabled).toBe(
      false
    );
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(c.textContent).not.toContain("✗ Save failed");
  });

  it("OTA with a whitespace-only version omits it from the request", async () => {
    routes["/api/admin/esp32?action=ota"] = { ok: true };
    const c = await renderPage();
    await click(screen.getByText("OTA Update"));
    fireEvent.change(c.querySelector("input[type='url']")!, {
      target: { value: "http://192.168.1.10/fw.bin" },
    });
    fireEvent.change(c.querySelector("input[placeholder='e.g. 4.1']")!, {
      target: { value: "   " },
    });
    await click(screen.getByText("⬆ Trigger OTA update"));
    expect(c.textContent).toContain("OTA command sent to esp32-leds");
    const ota = fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes("action=ota"));
    expect(JSON.parse(String(ota![1]!.body))).toEqual({
      device_id: "esp32-leds",
      firmware_url: "http://192.168.1.10/fw.bin",
    });
  });
});

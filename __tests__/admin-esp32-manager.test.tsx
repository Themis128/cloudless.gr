/**
 * Populated-state interaction tests for the ESP32 manager page — devices
 * list (rssi/uptime/ram formatting, stale chips), LED tab (severity matrix,
 * mute/test/clear, brightness, reboot), config load/save, OTA validation.
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

const DEVICES = [
  {
    device_id: "esp32-leds",
    ip: "192.168.1.50",
    rssi: -40,
    firmware_ver: "4.0",
    uptime_s: 90061,
    free_ram_bytes: 2048,
    last_heartbeat: "2026-01-01T10:00:00Z",
    stale: false,
  },
  { device_id: "esp32-door", stale: true }, // all optional fields absent → "—"
];

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

const cmdCalls = () =>
  fetchWithAuthMock.mock.calls
    .filter(([u]) => String(u).includes("action=command"))
    .map(([, i]) => JSON.parse(String(i!.body)));

describe("esp32-manager — populated interactions", () => {
  beforeEach(() => {
    routes = { "/api/admin/esp32?action=devices": DEVICES };
    fetchWithAuthMock.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("devices tab — cards, formatters, stale chip, offline banner, empty", async () => {
    const c = await renderPage();
    expect(c.textContent).toContain("2 devices registered");
    expect(c.textContent).toContain("esp32-leds");
    expect(c.textContent).toContain("Online");
    expect(c.textContent).toContain("Stale");
    expect(c.textContent).toContain("1d 1h 1m"); // 90061s
    expect(c.textContent).toContain("2 KB");
    expect(c.textContent).toContain("-40 dBm");
    expect(c.textContent).toContain("—"); // missing fields

    // offline flag → banner
    routes["/api/admin/esp32?action=devices"] = { offline: true };
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("Pi unreachable");

    // empty list
    routes["/api/admin/esp32?action=devices"] = [];
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("No devices yet");

    // fetch throw → offline
    routes["/api/admin/esp32?action=devices"] = () => Promise.reject(new Error("net"));
    await click(screen.getByText("Refresh"));
    expect(c.textContent).toContain("Pi unreachable");
  });

  it("led tab — severity matrix, mute/test/clear, brightness, reboot, fail", async () => {
    routes["/api/admin/esp32?action=command&device_id=esp32-leds"] = { ok: true };
    const c = await renderPage();
    await click(screen.getByText("LED Control"));

    await click(screen.getByText("Critical"));
    expect(cmdCalls()[0]).toEqual({ action: "led_mode", value: "critical" });
    expect(c.textContent).toContain("✓ led_mode sent");

    // device select appears (2 devices) — switch to door
    fireEvent.change(c.querySelector("select")!, { target: { value: "esp32-door" } });
    await click(screen.getByText("Info"));
    const doorCall = fetchWithAuthMock.mock.calls.find(
      ([u]) => String(u).includes("device_id=esp32-door")
    );
    expect(doorCall).toBeTruthy();

    // mute toggle + test + clear
    await click(screen.getByText("🔇 Mute"));
    expect(cmdCalls().some((b) => b.action === "led_mute" && b.value === true)).toBe(true);
    await click(screen.getByText("🔇 Unmute"));
    await click(screen.getByText("✦ Test pattern"));
    await click(screen.getByText("↺ Clear override"));
    expect(cmdCalls().some((b) => b.action === "led_test")).toBe(true);
    expect(cmdCalls().some((b) => b.action === "clear_override")).toBe(true);

    // brightness mouseUp fires command
    const slider = c.querySelector("input[type='range']")!;
    fireEvent.change(slider, { target: { value: "120" } });
    fireEvent.mouseUp(slider);
    await act(async () => {});
    expect(cmdCalls().some((b) => b.action === "set_brightness")).toBe(true);

    // reboot
    await click(screen.getByText("⚠ Reboot device"));
    expect(cmdCalls().some((b) => b.action === "reboot")).toBe(true);

    // failure path
    fetchWithAuthMock.mockResolvedValueOnce(okJson({ offline: true }));
    await click(screen.getByText("OK"));
    expect(c.textContent).toContain("✗ Command failed");
  });

  it("config tab — load, edit, save; retry path", async () => {
    routes["/api/admin/esp32?action=config&device_id=esp32-leds"] = {
      device_id: "esp32-leds",
      brightness: 200,
      heartbeat_interval_s: 60,
      mqtt_qos: 1,
    };
    const c = await renderPage();
    await click(screen.getByText("Config"));
    expect(c.textContent).toContain("retained MQTT message");

    // edit all three fields → dirty
    const range = c.querySelector("input[type='range']")!;
    fireEvent.change(range, { target: { value: "150" } });
    const num = c.querySelector("input[type='number']")!;
    fireEvent.change(num, { target: { value: "120" } });
    // QoS select — second select in DOM (first is the device picker)
    fireEvent.change(c.querySelectorAll("select")[1], { target: { value: "0" } });
    await click(screen.getByText("Save & publish to device"));
    expect(c.textContent).toContain("✓ Config saved & published to device");
    const putCall = fetchWithAuthMock.mock.calls.find(
      ([u, i]) => String(u).includes("action=config") && i?.method === "PUT"
    );
    expect(JSON.parse(String(putCall![1].body))).toMatchObject({
      brightness: 150,
      heartbeat_interval_s: 120,
      mqtt_qos: 0,
    });

    // config load fails → retry card
    routes["/api/admin/esp32?action=config&device_id=esp32-leds"] = () => Promise.reject(new Error("x"));
    cleanup();
    routes["/api/admin/esp32?action=devices"] = [];
    const c2 = await renderPage();
    await click(screen.getByText("Config"));
    expect(c2.textContent).toContain("Could not load config");
    await click(screen.getByText("Retry"));
  });

  it("ota tab — URL validation + trigger", async () => {
    const c = await renderPage();
    await click(screen.getByText("OTA Update"));

    const url = c.querySelector("input[type='url']") as HTMLInputElement;
    // non-http
    fireEvent.change(url, { target: { value: "ftp://x/f.bin" } });
    await click(screen.getByText("⬆ Trigger OTA update"));
    expect(c.textContent).toContain("must start with http://");

    // not .bin
    fireEvent.change(url, { target: { value: "https://x/f.zip" } });
    await click(screen.getByText("⬆ Trigger OTA update"));
    expect(c.textContent).toContain("must point to a .bin");

    // valid
    fireEvent.change(url, { target: { value: "https://x/firmware.BIN" } });
    const ver = c.querySelector("input[placeholder='e.g. 4.1']") as HTMLInputElement;
    fireEvent.change(ver, { target: { value: "4.2" } });
    routes["/api/admin/esp32?action=ota"] = { ok: true };
    await click(screen.getByText("⬆ Trigger OTA update"));
    expect(c.textContent).toContain("OTA command sent to esp32-leds");
    const otaCall = fetchWithAuthMock.mock.calls.find(([u]) => String(u).includes("action=ota"));
    expect(JSON.parse(String(otaCall![1].body))).toMatchObject({
      firmware_url: "https://x/firmware.BIN",
      version: "4.2",
    });

    // fail path
    routes["/api/admin/esp32?action=ota"] = { offline: true };
    fireEvent.change(url, { target: { value: "https://x/f2.bin" } });
    await click(screen.getByText("⬆ Trigger OTA update"));
    expect(c.textContent).toContain("Failed to send OTA command");
  });


  it("formats hours/minutes-only uptimes and tolerates invalid timestamps", async () => {
    routes["/api/admin/esp32?action=devices"] = [
      {
        device_id: "esp32-hours",
        uptime_s: 3700, // 1h 1m — hours branch
        last_heartbeat: "bogus-iso", // fmtTs catch → rendered verbatim
      },
      { device_id: "esp32-mins", uptime_s: 120 }, // 2m — minutes branch
    ];
    const c = await renderPage();
    expect(c.textContent).toContain("1h 1m");
    expect(c.textContent).toContain("2m");
    // invalid ISO is tolerated — toLocaleTimeString returns "Invalid Date"
    expect(c.textContent).toContain("Invalid Date");
  });

  it("switches back to the devices tab and fires brightness on touchEnd", async () => {
    const c = await renderPage();
    await click(screen.getByText("LED Control"));
    await click(screen.getByText("Devices"));
    expect(c.textContent).toContain("2 devices registered");

    // back to LED — touchEnd on the brightness slider sends the command
    await click(screen.getByText("LED Control"));
    fetchWithAuthMock.mockClear();
    const slider = c.querySelector('input[type="range"]')!;
    fireEvent.change(slider, { target: { value: "120" } });
    await act(async () => fireEvent.touchEnd(slider));
    const cmd = fetchWithAuthMock.mock.calls.find(([u]) =>
      String(u).includes("action=command")
    );
    expect(JSON.parse(String(cmd![1].body))).toMatchObject({
      action: "set_brightness",
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const notionFetchMock = vi.fn();
const getIntegrationsAsyncMock = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => notionFetchMock(...args),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: () => getIntegrationsAsyncMock(),
}));

describe("notion-esp32", () => {
  const originalDevices = process.env.NOTION_ESP32_DEVICES_DB_ID;
  const originalTelemetry = process.env.NOTION_ESP32_TELEMETRY_DB_ID;

  beforeEach(() => {
    notionFetchMock.mockReset();
    getIntegrationsAsyncMock.mockReset();
    delete process.env.NOTION_ESP32_DEVICES_DB_ID;
    delete process.env.NOTION_ESP32_TELEMETRY_DB_ID;
  });

  afterEach(() => {
    if (originalDevices === undefined) delete process.env.NOTION_ESP32_DEVICES_DB_ID;
    else process.env.NOTION_ESP32_DEVICES_DB_ID = originalDevices;
    if (originalTelemetry === undefined) delete process.env.NOTION_ESP32_TELEMETRY_DB_ID;
    else process.env.NOTION_ESP32_TELEMETRY_DB_ID = originalTelemetry;
  });

  describe("getEsp32NotionConfig", () => {
    it("reads from env vars first when present", async () => {
      process.env.NOTION_ESP32_DEVICES_DB_ID = "env-devices";
      process.env.NOTION_ESP32_TELEMETRY_DB_ID = "env-telemetry";
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg.devicesDbId).toBe("env-devices");
      expect(cfg.telemetryDbId).toBe("env-telemetry");
      // Did not touch the integrations module.
      expect(getIntegrationsAsyncMock).not.toHaveBeenCalled();
    });

    it("falls through to integrations when env vars are not set", async () => {
      getIntegrationsAsyncMock.mockResolvedValueOnce({
        NOTION_ESP32_DEVICES_DB_ID: "integ-devices",
        NOTION_ESP32_TELEMETRY_DB_ID: "integ-telemetry",
      });
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg.devicesDbId).toBe("integ-devices");
      expect(cfg.telemetryDbId).toBe("integ-telemetry");
    });

    it("returns {} when integrations throws and env is unset", async () => {
      getIntegrationsAsyncMock.mockRejectedValueOnce(new Error("ssm down"));
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg).toEqual({});
    });

    it("returns env values even when only one of two is set", async () => {
      process.env.NOTION_ESP32_DEVICES_DB_ID = "env-devices-only";
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg.devicesDbId).toBe("env-devices-only");
      expect(cfg.telemetryDbId).toBeUndefined();
      // Integrations was NOT consulted because env had at least one value.
      expect(getIntegrationsAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe("isEsp32NotionConfigured", () => {
    it("is true only when devicesDbId is present", async () => {
      const { isEsp32NotionConfigured } = await import("@/lib/notion-esp32");
      expect(isEsp32NotionConfigured({})).toBe(false);
      expect(isEsp32NotionConfigured({ telemetryDbId: "t" })).toBe(false);
      expect(isEsp32NotionConfigured({ devicesDbId: "d" })).toBe(true);
      expect(isEsp32NotionConfigured({ devicesDbId: "d", telemetryDbId: "t" })).toBe(true);
    });

    it("treats an empty string devicesDbId as unconfigured", async () => {
      const { isEsp32NotionConfigured } = await import("@/lib/notion-esp32");
      expect(isEsp32NotionConfigured({ devicesDbId: "" })).toBe(false);
    });
  });

  describe("upsertEsp32DeviceInNotion (no-op when unconfigured)", () => {
    it("returns null and does not call Notion when devicesDbId is missing", async () => {
      const { upsertEsp32DeviceInNotion } = await import("@/lib/notion-esp32");
      const result = await upsertEsp32DeviceInNotion({
        ip: "10.0.0.1",
        rssi: -55,
        firmware_ver: "1.0",
        uptime_s: 100,
        free_ram_bytes: 100_000,
        last_heartbeat: "2026-06-12T00:00:00Z",
        device_id: "dev-1",
        stale: false,
      });
      expect(result).toBeNull();
      expect(notionFetchMock).not.toHaveBeenCalled();
    });
  });

  describe("appendEsp32TelemetryToNotion (no-op when unconfigured)", () => {
    it("returns null when telemetryDbId is missing", async () => {
      const { appendEsp32TelemetryToNotion } = await import("@/lib/notion-esp32");
      const result = await appendEsp32TelemetryToNotion({
        code: "ESP32_LOW_RAM",
        host: "esp32-1",
        severity: "high",
        message: "RAM low",
        status: "ACTIVE",
        first_seen: "2026-06-12T00:00:00Z",
        last_seen: "2026-06-12T00:00:00Z",
      });
      expect(result).toBeNull();
      expect(notionFetchMock).not.toHaveBeenCalled();
    });
  });

  describe("readEsp32DevicesFromNotion (no-op when unconfigured)", () => {
    it("returns [] when devicesDbId is missing", async () => {
      const { readEsp32DevicesFromNotion } = await import("@/lib/notion-esp32");
      const out = await readEsp32DevicesFromNotion();
      expect(out).toEqual([]);
      expect(notionFetchMock).not.toHaveBeenCalled();
    });
  });
});

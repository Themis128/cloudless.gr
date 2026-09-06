import { describe, it, expect, vi, afterEach } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ MQTT_USERNAME: "", MQTT_PASSWORD: "" });

import { MqttNotConfiguredError, isMqttConfigured, resetMqttCache } from "@/lib/mqtt";

afterEach(() => resetMqttCache());

describe("MqttNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new MqttNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MqttNotConfiguredError");
    expect(err.message).toContain("MQTT_USERNAME");
  });
});

describe("isMqttConfigured", () => {
  it("returns false when MQTT credentials are not configured", async () => {
    expect(await isMqttConfigured()).toBe(false);
  });
});

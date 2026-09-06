import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { syncESP32Devices, getESP32Alerts, acknowledgeESP32Alert } from "@/lib/appflowy-esp32";

describe("appflowy-esp32 (not configured)", () => {
  it("syncESP32Devices returns [] when AppFlowy is not configured", async () => {
    expect(await syncESP32Devices()).toEqual([]);
  });

  it("getESP32Alerts returns [] when not configured", async () => {
    expect(await getESP32Alerts()).toEqual([]);
  });

  it("acknowledgeESP32Alert returns false when not configured", async () => {
    expect(await acknowledgeESP32Alert("alert-id")).toBe(false);
  });
});

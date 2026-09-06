import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ GRAFANA_API_TOKEN: "" });

import {
  GrafanaNotConfiguredError,
  GrafanaApiError,
  isGrafanaConfigured,
} from "@/lib/grafana";

describe("GrafanaNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new GrafanaNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GrafanaNotConfiguredError");
    expect(err.message).toContain("GRAFANA_API_TOKEN");
  });
});

describe("GrafanaApiError", () => {
  it("is an Error with status", () => {
    const err = new GrafanaApiError(503, "unavailable");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.message).toContain("503");
  });
});

describe("isGrafanaConfigured", () => {
  it("returns false when GRAFANA_API_TOKEN is empty", async () => {
    expect(await isGrafanaConfigured()).toBe(false);
  });
});

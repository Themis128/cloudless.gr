import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ N8N_API_URL: "", N8N_API_KEY: "" });

import {
  N8nNotConfiguredError,
  N8nApiError,
  isN8nConfigured,
} from "@/lib/n8n";

describe("N8nNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new N8nNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("N8nNotConfiguredError");
    expect(err.message).toContain("N8N_API_URL");
  });
});

describe("N8nApiError", () => {
  it("is an Error with status", () => {
    const err = new N8nApiError(404, "not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toContain("404");
  });
});

describe("isN8nConfigured", () => {
  it("returns false when N8N_API_URL is empty", async () => {
    expect(await isN8nConfigured()).toBe(false);
  });
});

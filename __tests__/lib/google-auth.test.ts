import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));
vi.mock("@/lib/google-sa-key", () => ({
  loadGooglePrivateKey: vi.fn().mockReturnValue({}),
  normalizeGooglePrivateKeyPem: vi.fn().mockReturnValue("pem"),
}));

mockGetCfg.mockResolvedValue({ GOOGLE_CLIENT_EMAIL: "", GOOGLE_PRIVATE_KEY: "" });

import { createGoogleAuth } from "@/lib/google-auth";

describe("createGoogleAuth", () => {
  it("returns a function", () => {
    const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
    expect(typeof getToken).toBe("function");
  });

  it("the returned function throws when credentials are not configured", async () => {
    const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
    await expect(getToken()).rejects.toThrow("Google service account not configured");
  });
});

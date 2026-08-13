import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
const mockFetch = vi.fn();

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setProtectedHeader = vi.fn().mockReturnThis();
    this.setIssuedAt = vi.fn().mockReturnThis();
    this.setExpirationTime = vi.fn().mockReturnThis();
    this.sign = vi.fn().mockResolvedValue("mock-jwt");
  }),
}));

const mockLoadGooglePrivateKey = vi.fn().mockReturnValue({ type: "private" });

vi.mock("@/lib/google-sa-key", () => ({
  loadGooglePrivateKey: (...args: unknown[]) => mockLoadGooglePrivateKey(...args),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
  resetSsmCache: vi.fn(),
}));

globalThis.fetch = mockFetch as unknown as typeof fetch;

const fakePrivateKey =
  "-----BEGIN PRIVATE KEY-----\n" +
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3wo".repeat(4) +
  "\n-----END PRIVATE KEY-----";

describe("createGoogleAuth()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "svc@project.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: fakePrivateKey,
    });
  });

  it("throws when GOOGLE_CLIENT_EMAIL is missing", async () => {
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: fakePrivateKey,
    });
    const { createGoogleAuth } = await import("@/lib/google-auth");
    const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
    await expect(getToken()).rejects.toThrow("Google service account not configured");
  });

  it("throws when GOOGLE_PRIVATE_KEY is missing", async () => {
    mockGetConfig.mockResolvedValue({
      GOOGLE_CLIENT_EMAIL: "svc@project.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: "",
    });
    const { createGoogleAuth } = await import("@/lib/google-auth");
    const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
    await expect(getToken()).rejects.toThrow("Google service account not configured");
  });

  it("returns different getToken functions per scope", async () => {
    const { createGoogleAuth } = await import("@/lib/google-auth");
    const fn1 = createGoogleAuth("scope1");
    const fn2 = createGoogleAuth("scope2");
    expect(fn1).not.toBe(fn2);
  });

  it("fetch error results in a rejected promise", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    const { createGoogleAuth } = await import("@/lib/google-auth");
    const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
    await expect(getToken()).rejects.toThrow("Google token error: 401");
    expect(mockLoadGooglePrivateKey).toHaveBeenCalledWith(fakePrivateKey);
  });
});

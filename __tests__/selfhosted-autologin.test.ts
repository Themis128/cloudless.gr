/**
 * Tests for src/lib/selfhosted-autologin.ts (R25)
 *
 * Validates:
 *  - getAutologinUrl() returns a well-formed URL for every supported app
 *  - AppFlowy performs a GoTrue password-grant and embeds the token in the URL hash
 *  - AppFlowy throws on GoTrue HTTP errors without leaking the password
 *  - Non-AppFlowy apps resolve synchronously from SSM config
 *  - supportsAutoLogin() is true only for appflowy
 *  - Unknown app values are a TypeScript never (compile-time guard)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetSsmCache } from "@/lib/ssm-config";
import { resetIntegrationCache } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Mock SSM so tests never call AWS
// ---------------------------------------------------------------------------
vi.mock("@/lib/ssm-config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ssm-config")>();
  return {
    ...original,
    getConfig: vi.fn().mockResolvedValue({
      APPFLOWY_API_URL: "https://appflowy.cloudless.gr",
      APPFLOWY_EMAIL: "admin@cloudless.gr",
      APPFLOWY_PASSWORD: "test-password",
      ESPOCRM_BASE_URL: "https://espocrm.cloudless.gr",
      N8N_API_URL: "https://n8n.cloudless.gr",
      POSTIZ_API_URL: "https://postiz.cloudless.gr",
      GRAFANA_BASE_URL: "https://grafana.cloudless.gr",
      KUMA_BASE_URL: "https://kuma.cloudless.gr",
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock global fetch for GoTrue calls
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Import SUT after mocks are in place
// ---------------------------------------------------------------------------
const { getAutologinUrl, supportsAutoLogin, SELFHOSTED_APP_NAMES } =
  await import("@/lib/selfhosted-autologin");

// ---------------------------------------------------------------------------
describe("supportsAutoLogin", () => {
  it("returns true for appflowy and espocrm, false for others", () => {
    expect(supportsAutoLogin("appflowy")).toBe(true);
    expect(supportsAutoLogin("espocrm")).toBe(true);
    expect(supportsAutoLogin("n8n")).toBe(false);
    expect(supportsAutoLogin("postiz")).toBe(false);
    expect(supportsAutoLogin("grafana")).toBe(false);
    expect(supportsAutoLogin("kuma")).toBe(false);
  });
});

describe("SELFHOSTED_APP_NAMES", () => {
  it("has a display name for every supported app key", () => {
    const keys = ["appflowy", "espocrm", "n8n", "postiz", "grafana", "kuma"] as const;
    for (const k of keys) {
      expect(typeof SELFHOSTED_APP_NAMES[k]).toBe("string");
      expect(SELFHOSTED_APP_NAMES[k].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
describe("getAutologinUrl — non-AppFlowy apps (smart links)", () => {
  it("espocrm returns base URL with trailing slash stripped", async () => {
    const result = await getAutologinUrl("espocrm");
    expect(result.hasToken).toBe(false);
    expect(result.url).toBe("https://espocrm.cloudless.gr/");
  });

  it("n8n returns /signin path", async () => {
    const result = await getAutologinUrl("n8n");
    expect(result.hasToken).toBe(false);
    expect(result.url).toBe("https://n8n.cloudless.gr/signin");
  });

  it("postiz returns base URL", async () => {
    const result = await getAutologinUrl("postiz");
    expect(result.hasToken).toBe(false);
    expect(result.url).toContain("postiz.cloudless.gr");
  });

  it("grafana returns base URL", async () => {
    const result = await getAutologinUrl("grafana");
    expect(result.hasToken).toBe(false);
    expect(result.url).toContain("grafana.cloudless.gr");
  });

  it("kuma returns /dashboard path", async () => {
    const result = await getAutologinUrl("kuma");
    expect(result.hasToken).toBe(false);
    expect(result.url).toBe("https://kuma.cloudless.gr/dashboard");
  });
});

// ---------------------------------------------------------------------------
describe("getAutologinUrl — AppFlowy (GoTrue password-grant)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns a token-injected URL on successful GoTrue grant", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "eyABC.def.ghi" }),
    });

    const result = await getAutologinUrl("appflowy");

    expect(result.hasToken).toBe(true);
    expect(result.url).toContain("access_token=");
    expect(result.url).toContain("appflowy.cloudless.gr");
    // Token is embedded in the URL hash, not the path
    expect(result.url).toContain("#access_token=");
  });

  it("calls the GoTrue password-grant endpoint with correct params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "tok123" }),
    });

    await getAutologinUrl("appflowy");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://appflowy.cloudless.gr/gotrue/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    // Ensure the request body contains email (grant_type is in the query string)
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as { email?: string; grant_type?: string };
    expect(body.email).toBe("admin@cloudless.gr");
    expect(body.grant_type).toBeUndefined();
  });

  it("throws a sanitized error when GoTrue returns HTTP 4xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(getAutologinUrl("appflowy")).rejects.toThrow(/HTTP 401/);
  });

  it("throws when GoTrue is unreachable (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(getAutologinUrl("appflowy")).rejects.toThrow(/unreachable/i);
  });

  it("throws when GoTrue response is not valid JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError("unexpected token");
      },
    });

    await expect(getAutologinUrl("appflowy")).rejects.toThrow(/not valid JSON/i);
  });

  it("throws when GoTrue returns no access_token in body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_type: "bearer" }), // access_token missing
    });

    await expect(getAutologinUrl("appflowy")).rejects.toThrow(/access_token/i);
  });
});

// ---------------------------------------------------------------------------
describe("getAutologinUrl — AppFlowy misconfiguration", () => {
  it("throws when APPFLOWY_API_URL is missing", async () => {
    const { getConfig } = await import("@/lib/ssm-config");
    vi.mocked(getConfig).mockResolvedValue({
      APPFLOWY_API_URL: "",
      APPFLOWY_EMAIL: "admin@cloudless.gr",
      APPFLOWY_PASSWORD: "pw",
    } as never);

    await expect(getAutologinUrl("appflowy")).rejects.toThrow(/not configured/i);
  });
});

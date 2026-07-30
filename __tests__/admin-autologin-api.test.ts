/**
 * Tests for GET /api/admin/autologin
 *
 * Covers:
 * - Auth enforcement (401, 403)
 * - Unknown ?app → 400
 * - Non-AppFlowy apps return canonical URLs (no token)
 * - AppFlowy: successful GoTrue → returns URL with token + hasToken=true
 * - AppFlowy: GoTrue HTTP error → 502 with safe error message
 * - AppFlowy: GoTrue network error → 502
 * - AppFlowy: missing config → 502
 * - Token values never leak in 502 response body
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mock variables
// ---------------------------------------------------------------------------

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ssm-config
// ---------------------------------------------------------------------------

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock jose so JWT verify doesn't need a real JWKS endpoint
// ---------------------------------------------------------------------------

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

// ---------------------------------------------------------------------------
// Base SSM config shared across tests
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  // AppFlowy
  APPFLOWY_API_URL: "https://appflowy.cloudless.gr",
  APPFLOWY_JWT_SECRET: "jwt-secret-test",
  APPFLOWY_EMAIL: "admin@cloudless.gr",
  APPFLOWY_PASSWORD: "s3cr3t-p4ssw0rd",
  // EspoCRM
  ESPOCRM_BASE_URL: "https://espocrm.cloudless.gr",
  ESPOCRM_API_KEY: "espo-api-key",
  // n8n
  N8N_API_URL: "https://n8n.cloudless.gr",
  N8N_API_KEY: "n8n-api-key",
  // Postiz
  POSTIZ_API_URL: "https://postiz.cloudless.gr",
  POSTIZ_API_KEY: "postiz-api-key",
  // Grafana
  GRAFANA_BASE_URL: "https://grafana.cloudless.gr",
  GRAFANA_API_TOKEN: "grafana-token",
  // Kuma
  KUMA_BASE_URL: "https://kuma.cloudless.gr",
  KUMA_STATUS_PAGE_SLUG: "cloudless",
  // Other required fields
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
};

mockGetConfig.mockResolvedValue(BASE_CONFIG);

beforeEach(() => {
  mockGetConfig.mockResolvedValue(BASE_CONFIG);
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Token helpers — mirrors admin-api.test.ts pattern
// ---------------------------------------------------------------------------

function makeToken(isAdmin = false): string {
  return isAdmin ? "test-admin-session" : "test-user-session";
}

function adminRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken(["admin"])}` },
  });
}

function userRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeToken([])}` },
  });
}

function unauthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Auth enforcement
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — auth", () => {
  it("returns 401 with no token", async () => {
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/autologin?app=kuma"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(userRequest("http://localhost/api/admin/autologin?app=kuma"));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — validation", () => {
  it("returns 400 for unknown app", async () => {
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=unknown-app"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown app");
    expect(data.error).toContain("Valid values");
    expect(data.error).not.toContain("unknown-app");
  });

  it("returns 400 when ?app is omitted", async () => {
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin"));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Non-AppFlowy apps — should return canonical URLs without calling fetch()
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — smart-link apps", () => {
  beforeEach(() => {
    // Stub fetch so any accidental GoTrue calls become visible failures.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch should not be called for smart-link apps"))
    );
  });

  it("espocrm → 200 with base URL, hasToken=false", async () => {
    vi.unstubAllGlobals(); // reset fetch override — no HTTP call expected
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=espocrm"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.app).toBe("espocrm");
    expect(data.hasToken).toBe(false);
    expect(data.url).toBe("https://espocrm.cloudless.gr/");
  });

  it("n8n → 200 pointing to /signin, hasToken=false", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=n8n"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.app).toBe("n8n");
    expect(data.hasToken).toBe(false);
    expect(data.url).toContain("n8n.cloudless.gr");
    expect(data.url).toContain("/signin");
  });

  it("postiz → 200 with base URL, hasToken=false", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=postiz"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.app).toBe("postiz");
    expect(data.hasToken).toBe(false);
    expect(data.url).toContain("postiz.cloudless.gr");
  });

  it("grafana → 200 with grafana base URL, hasToken=false", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=grafana"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.app).toBe("grafana");
    expect(data.hasToken).toBe(false);
    expect(data.url).toContain("grafana.cloudless.gr");
  });

  it("kuma → 200 with /dashboard path, hasToken=false", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=kuma"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.app).toBe("kuma");
    expect(data.hasToken).toBe(false);
    expect(data.url).toBe("https://kuma.cloudless.gr/dashboard");
  });
});

// ---------------------------------------------------------------------------
// AppFlowy — GoTrue password grant
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — appflowy", () => {
  it("returns redirect URL with access_token in hash when GoTrue succeeds", async () => {
    const fakeToken = "eyJfake.eyJsub.sig";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: fakeToken, token_type: "bearer", expires_in: 3600 }),
      })
    );

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.app).toBe("appflowy");
    expect(data.hasToken).toBe(true);
    expect(data.url).toContain("appflowy.cloudless.gr");
    expect(data.url).toContain("access_token=");
    expect(data.url).toContain(encodeURIComponent(fakeToken));
    // URL must be a hash-based redirect so the token is not sent to the server
    expect(data.url).toContain("#access_token=");
  });

  it("calls the GoTrue password-grant endpoint with email + password", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok123", token_type: "bearer", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await import("@/app/api/admin/autologin/route");
    await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));

    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("gotrue/token");
    expect(calledUrl).toContain("grant_type=password");
    // Body must contain email — we don't assert the password value to avoid
    // having it appear in test output, just that it's present.
    const body = JSON.parse(calledInit.body as string) as { email: string; password: string };
    expect(body.email).toBe("admin@cloudless.gr");
    expect(typeof body.password).toBe("string");
    expect(body.password.length).toBeGreaterThan(0);
  });

  it("returns 502 when GoTrue returns a non-OK HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_grant" }),
      })
    );

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeTruthy();
    // The password must not appear in the error response
    expect(JSON.stringify(data)).not.toContain("s3cr3t-p4ssw0rd");
  });

  it("returns 502 when GoTrue is unreachable (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 502 when AppFlowy credentials are not configured", async () => {
    mockGetConfig.mockResolvedValueOnce({
      ...BASE_CONFIG,
      APPFLOWY_EMAIL: "",
      APPFLOWY_PASSWORD: "",
    });

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 502 when GoTrue response has no access_token field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token_type: "bearer" }), // missing access_token
      })
    );

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// Security: token values must not appear in any 502 response body
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — token security", () => {
  it("long token-like strings in errors are redacted from 502 response", async () => {
    // Simulate an error message that accidentally contains the raw token
    const longSecret = "A".repeat(50); // 50 chars — matches the redaction regex
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`Something went wrong: ${longSecret}`))
    );

    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=appflowy"));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain(longSecret);
    expect(data.error).toBe("Failed to get login URL");
  });
});

// ---------------------------------------------------------------------------
// Response shape invariants
// ---------------------------------------------------------------------------

describe("GET /api/admin/autologin — response shape", () => {
  it("always returns { url, app, hasToken } on success", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=kuma"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.url).toBe("string");
    expect(typeof data.app).toBe("string");
    expect(typeof data.hasToken).toBe("boolean");
  });

  it("Cache-Control: no-store is set on success response", async () => {
    vi.unstubAllGlobals();
    const { GET } = await import("@/app/api/admin/autologin/route");
    const res = await GET(adminRequest("http://localhost/api/admin/autologin?app=kuma"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

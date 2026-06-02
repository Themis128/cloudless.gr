/**
 * Unit tests for POST /api/auth/resend-verification
 *
 * Re-sends the Keycloak verification email for an existing, not-yet-verified
 * user. Uses the Admin REST API (client_credentials → search by email →
 * send-verify-email). Always responds { ok: true } to avoid account
 * enumeration. All HTTP calls are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

const ISSUER = "https://auth.test/realms/master";
const REALM = "master";
const ADMIN_CFG = {
  KEYCLOAK_ADMIN_CLIENT_ID: "cloudless-admin-api",
  KEYCLOAK_ADMIN_CLIENT_SECRET: "s3cr3t",
};

function tokenOk() {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ access_token: "tok-123" }) };
}
function searchOk(users: unknown[]) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => users };
}
function verifyOk() {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
}
function req(body: unknown) {
  return new Request("http://localhost/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resend-verification", () => {
  const origFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.KEYCLOAK_ISSUER = ISSUER;
    process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = "cloudless-app";
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr";
    mockGetConfig.mockResolvedValue(ADMIN_CFG);
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("returns 503 when KEYCLOAK_ISSUER is not set", async () => {
    delete process.env.KEYCLOAK_ISSUER;
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when issuer does not match the /realms/ pattern", async () => {
    process.env.KEYCLOAK_ISSUER = "https://auth.test/not-a-realm";
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    expect((await POST(req({ email: "a@b.com" }))).status).toBe(503);
  });

  it("returns 503 when admin client credentials are missing from SSM", async () => {
    mockGetConfig.mockResolvedValue({ KEYCLOAK_ADMIN_CLIENT_ID: "", KEYCLOAK_ADMIN_CLIENT_SECRET: "x" });
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    expect((await POST(req({ email: "a@b.com" }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed email (never reaches Keycloak)", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const bad = new Request("http://localhost/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "nope",
    });
    expect((await POST(bad)).status).toBe(400);
  });

  it("re-sends the verify email for an existing unverified user", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(searchOk([{ id: "uid-7", emailVerified: false }]))
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "u@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [verifyUrl, verifyOpts] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(verifyUrl).toContain(`/admin/realms/${REALM}/users/uid-7/send-verify-email`);
    expect(verifyOpts.method).toBe("PUT");
    expect(verifyUrl).toContain("client_id=cloudless-app");
    expect(verifyUrl).toContain("redirect_uri=");
  });

  it("does NOT re-send for an already-verified user (still ok)", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(searchOk([{ id: "uid-8", emailVerified: true }]));
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "v@b.com" }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // token + search, no send-verify
  });

  it("returns ok without sending when the email is unknown (no enumeration)", async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(searchOk([]));
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "missing@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns ok even when the admin token fetch fails (never leaks)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) });
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

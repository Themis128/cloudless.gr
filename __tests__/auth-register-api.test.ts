/**
 * Unit tests for POST /api/auth/register
 *
 * The route creates a Keycloak user via Admin REST API (client_credentials),
 * sets the VERIFY_EMAIL required action, and sends a verification email link.
 * All three HTTP calls (token, create user, send-verify-email) are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

const ISSUER = "https://auth.test/realms/master";
const KC_BASE = "https://auth.test";
const REALM = "master";
const ADMIN_CFG = {
  KEYCLOAK_ADMIN_CLIENT_ID: "cloudless-admin-api",
  KEYCLOAK_ADMIN_CLIENT_SECRET: "s3cr3t",
};

// ── fetch response factories ──────────────────────────────────────────────────

function tokenOk() {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ access_token: "tok-123" }),
  };
}

function createOk(userId = "uid-abc") {
  return {
    ok: true,
    status: 201,
    headers: {
      get: (k: string) =>
        k === "Location" ? `${KC_BASE}/admin/realms/${REALM}/users/${userId}` : null,
    },
    json: async () => ({}),
  };
}

function verifyOk() {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
}

// ── request factory ───────────────────────────────────────────────────────────

function req(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
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

  // ── config guards ──────────────────────────────────────────────────────────

  it("returns 503 when KEYCLOAK_ISSUER is not set", async () => {
    delete process.env.KEYCLOAK_ISSUER;
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when issuer does not match /realms/ pattern", async () => {
    process.env.KEYCLOAK_ISSUER = "https://auth.test/not-a-realm";
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when admin client ID is missing from SSM", async () => {
    mockGetConfig.mockResolvedValue({ KEYCLOAK_ADMIN_CLIENT_ID: "", KEYCLOAK_ADMIN_CLIENT_SECRET: "x" });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when admin client secret is missing from SSM", async () => {
    mockGetConfig.mockResolvedValue({ KEYCLOAK_ADMIN_CLIENT_ID: "id", KEYCLOAK_ADMIN_CLIENT_SECRET: "" });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(503);
  });

  // ── input validation ───────────────────────────────────────────────────────

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ password: "password1" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when password is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/8/);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const badReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  // ── Keycloak API error handling ────────────────────────────────────────────

  it("returns 500 when admin token fetch fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: async () => ({}),
    });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(500);
  });

  it("returns 409 when email already exists in Keycloak", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        headers: { get: () => null },
        json: async () => ({}),
      });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "existing@b.com", password: "password1" }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/already exists/i);
  });

  it("returns 400 with Keycloak errorMessage on password policy violation", async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ errorMessage: "Password does not meet policy requirements" }),
    });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Password does not meet policy requirements");
  });

  it("returns 400 with fallback message when Keycloak gives no errorMessage", async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({}),
    });
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(400);
  });

  // ── success path ───────────────────────────────────────────────────────────

  it("returns { ok: true } on successful registration", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "new@b.com", password: "password1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sends verification email to the newly created user", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk("uid-42"))
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "new@b.com", password: "password1" }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [verifyUrl, verifyOpts] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(verifyUrl).toContain(`/users/uid-42/send-verify-email`);
    expect(verifyOpts.method).toBe("PUT");
    expect(verifyUrl).toContain("client_id=cloudless-app");
    expect(verifyUrl).toContain("redirect_uri=");
    expect(verifyUrl).toContain("cloudless.gr");
  });

  it("user representation sets emailVerified=false and VERIFY_EMAIL required action", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "password1" }));
    const userRep = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<
      string,
      unknown
    >;
    expect(userRep.emailVerified).toBe(false);
    expect(userRep.enabled).toBe(true);
    expect(userRep.requiredActions).toContain("VERIFY_EMAIL");
    expect(userRep.username).toBe("a@b.com");
    expect(userRep.email).toBe("a@b.com");
  });

  it("splits fullName into firstName + lastName on the user representation", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "password1", fullName: "John Doe Smith" }));
    const userRep = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<
      string,
      unknown
    >;
    expect(userRep.firstName).toBe("John");
    expect(userRep.lastName).toBe("Doe Smith");
  });

  it("omits firstName/lastName when fullName is absent or empty", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "password1" }));
    const userRep = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<
      string,
      unknown
    >;
    expect(userRep.firstName).toBeUndefined();
    expect(userRep.lastName).toBeUndefined();
  });

  it("still returns 200 when the verification email call throws (best-effort)", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk("uid-99"))
      .mockRejectedValueOnce(new Error("SMTP not configured"));
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(200);
  });

  it("admin token uses client_credentials grant with correct client_id", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "password1" }));
    const [tokenUrl, tokenOpts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe(`${ISSUER}/protocol/openid-connect/token`);
    const formBody = new URLSearchParams(tokenOpts.body as string);
    expect(formBody.get("grant_type")).toBe("client_credentials");
    expect(formBody.get("client_id")).toBe(ADMIN_CFG.KEYCLOAK_ADMIN_CLIENT_ID);
    expect(formBody.get("client_secret")).toBe(ADMIN_CFG.KEYCLOAK_ADMIN_CLIENT_SECRET);
  });

  it("user creation request uses admin bearer token and correct Admin API URL", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(createOk())
      .mockResolvedValueOnce(verifyOk());
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "password1" }));
    const [createUrl, createOpts] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toBe(`${KC_BASE}/admin/realms/${REALM}/users`);
    expect((createOpts.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-123");
  });
});

// @vitest-environment node
/**
 * Unit tests for POST /api/auth/register
 *
 * The route creates a Cognito user via SignUpCommand.
 * The AWS SDK client is mocked so no real AWS call is made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = sendMock;
  },
  SignUpCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

function req(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST";
const CLIENT_ID = "test-client-id";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.COGNITO_ISSUER = COGNITO_ISSUER;
    process.env.COGNITO_CLIENT_ID = CLIENT_ID;
    delete process.env.COGNITO_CLIENT_SECRET;
  });

  afterEach(() => {
    delete process.env.COGNITO_ISSUER;
    delete process.env.COGNITO_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_SECRET;
  });

  // ── config guards ──────────────────────────────────────────────────────────

  it("returns 503 when COGNITO_CLIENT_ID is not set", async () => {
    delete process.env.COGNITO_CLIENT_ID;
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "Test123!" }));
    expect(res.status).toBe(503);
    expect(sendMock).not.toHaveBeenCalled();
  });

  // ── input validation ───────────────────────────────────────────────────────

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ password: "Test123!" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when password is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(400);
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

  // ── Cognito error handling ─────────────────────────────────────────────────

  it("returns 200 { ok: true } (enum-safe) when Cognito throws UsernameExistsException", async () => {
    const err = Object.assign(new Error("User exists"), { name: "UsernameExistsException" });
    sendMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "existing@b.com", password: "Test123!" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 when Cognito throws InvalidPasswordException", async () => {
    const err = Object.assign(new Error("Bad password"), { name: "InvalidPasswordException" });
    sendMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "weak" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/password/i);
  });

  it("returns 400 when Cognito throws InvalidParameterException", async () => {
    const err = Object.assign(new Error("Bad param"), { name: "InvalidParameterException" });
    sendMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "weak" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected Cognito errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("Internal error"));
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "a@b.com", password: "Test123!" }));
    expect(res.status).toBe(500);
  });

  // ── success path ───────────────────────────────────────────────────────────

  it("returns { ok: true, token: string } on successful registration", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(req({ email: "new@b.com", password: "Test123!" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; token: string };
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3);
  });

  it("includes fullName as UserAttributes name when provided", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "Test123!", fullName: "John Doe" }));
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as {
      input: { UserAttributes: Array<{ Name: string; Value: string }> };
    };
    expect(cmd.input.UserAttributes).toContainEqual({ Name: "name", Value: "John Doe" });
  });

  it("omits name attribute when fullName is absent", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "Test123!" }));
    const cmd = sendMock.mock.calls[0][0] as {
      input: { UserAttributes: Array<{ Name: string }> };
    };
    expect(cmd.input.UserAttributes.find((a) => a.Name === "name")).toBeUndefined();
  });

  it("includes SecretHash when COGNITO_CLIENT_SECRET is set", async () => {
    process.env.COGNITO_CLIENT_SECRET = "s3cr3t";
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "Test123!" }));
    const cmd = sendMock.mock.calls[0][0] as { input: { SecretHash?: string } };
    expect(typeof cmd.input.SecretHash).toBe("string");
    expect(cmd.input.SecretHash!.length).toBeGreaterThan(0);
  });

  it("omits SecretHash when COGNITO_CLIENT_SECRET is not set", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/register/route");
    await POST(req({ email: "a@b.com", password: "Test123!" }));
    const cmd = sendMock.mock.calls[0][0] as { input: { SecretHash?: string } };
    expect(cmd.input.SecretHash).toBeUndefined();
  });
});

// @vitest-environment node
/**
 * Unit tests for POST /api/auth/resend-verification
 *
 * Re-sends the Cognito verification code via ResendConfirmationCodeCommand.
 * Always responds { ok: true } to avoid account enumeration.
 * The AWS SDK client is mocked so no real AWS call is made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = sendMock;
  },
  ResendConfirmationCodeCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

function req(body: unknown) {
  return new Request("http://localhost/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST";
const CLIENT_ID = "test-client-id";

describe("POST /api/auth/resend-verification", () => {
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

  it("always returns 200 with ok and a token", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "u@b.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; token?: string };
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
  });

  it("calls ResendConfirmationCodeCommand when email and clientId are present", async () => {
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    await POST(req({ email: "u@b.com" }));
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as {
      input: { Username: string; ClientId: string };
    };
    expect(cmd.input.Username).toBe("u@b.com");
    expect(cmd.input.ClientId).toBe(CLIENT_ID);
  });

  it("swallows errors from Cognito and still returns 200 ok", async () => {
    sendMock.mockRejectedValueOnce(new Error("Cognito error"));
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "u@b.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 200 without calling SDK when COGNITO_CLIENT_ID is not set", async () => {
    delete process.env.COGNITO_CLIENT_ID;
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "u@b.com" }));
    expect(res.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 200 without calling SDK when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 200 ok when request body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const badReq = new Request("http://localhost/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("includes SecretHash when COGNITO_CLIENT_SECRET is set", async () => {
    process.env.COGNITO_CLIENT_SECRET = "s3cr3t";
    sendMock.mockResolvedValueOnce({});
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    await POST(req({ email: "u@b.com" }));
    const cmd = sendMock.mock.calls[0][0] as { input: { SecretHash?: string } };
    expect(typeof cmd.input.SecretHash).toBe("string");
    expect(cmd.input.SecretHash!.length).toBeGreaterThan(0);
  });
});

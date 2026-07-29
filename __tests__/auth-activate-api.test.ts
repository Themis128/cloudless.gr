// @vitest-environment node
/**
 * POST /api/auth/activate — Cognito when pool set; D1 email_verified otherwise.
 */
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getAuthDbMock = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: (...a: unknown[]) => getAuthDbMock(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  AdminConfirmSignUpCommand: class {
    constructor(public input: unknown) {}
  },
}));

const SECRET = "test-activate-secret";

function makeToken(email: string): { token: string; otp: string } {
  const nonce = "nonce123";
  const exp = Date.now() + 600_000;
  const sig = createHmac("sha256", SECRET)
    .update(`${email}:${exp}:${nonce}`)
    .digest("base64url");
  const token = `${nonce}.${exp}.${sig}`;
  const otp = (
    parseInt(
      createHmac("sha256", SECRET).update(`otp:${email}:${exp}:${nonce}`).digest("hex").slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");
  return { token, otp };
}

function req(body: unknown) {
  return new NextRequest("http://localhost/api/auth/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/activate (D1 fallback)", () => {
  const prevSecret = process.env.AUTH_SECRET;
  const prevPool = process.env.COGNITO_USER_POOL_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.AUTH_SECRET = SECRET;
    delete process.env.COGNITO_USER_POOL_ID;
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevSecret;
    if (prevPool === undefined) delete process.env.COGNITO_USER_POOL_ID;
    else process.env.COGNITO_USER_POOL_ID = prevPool;
  });

  it("returns 503 when Cognito unset and AUTH_DB missing", async () => {
    getAuthDbMock.mockReturnValue(null);
    const email = "user@cloudless.gr";
    const { token, otp } = makeToken(email);
    const { POST } = await import("@/app/api/auth/activate/route");
    const res = await POST(req({ email, otp, token }));
    expect(res.status).toBe(503);
  });

  it("marks email_verified in D1 when Cognito unset", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    getAuthDbMock.mockReturnValue({ prepare });

    const email = "user@cloudless.gr";
    const { token, otp } = makeToken(email);
    const { POST } = await import("@/app/api/auth/activate/route");
    const res = await POST(req({ email, otp, token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prepare).toHaveBeenCalled();
    expect(bind).toHaveBeenCalledWith(email);
    expect(run).toHaveBeenCalled();
  });

  it("returns 400 for bad OTP", async () => {
    getAuthDbMock.mockReturnValue({ prepare: vi.fn() });
    const email = "user@cloudless.gr";
    const { token } = makeToken(email);
    const { POST } = await import("@/app/api/auth/activate/route");
    const res = await POST(req({ email, otp: "000000", token }));
    expect(res.status).toBe(400);
  });
});

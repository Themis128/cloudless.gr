// @vitest-environment node
/**
 * POST /api/auth/activate — D1 email_verified only (PR-04).
 */
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getAuthDbMock = vi.fn();
const markEmailVerified = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: (...a: unknown[]) => getAuthDbMock(...a),
  markEmailVerified: (...a: unknown[]) => markEmailVerified(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
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

describe("POST /api/auth/activate (D1)", () => {
  const prevSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.AUTH_SECRET = SECRET;
    delete process.env.COGNITO_USER_POOL_ID;
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevSecret;
  });

  it("returns 503 when AUTH_DB missing", async () => {
    getAuthDbMock.mockReturnValue(null);
    markEmailVerified.mockResolvedValue(false);
    const email = "user@cloudless.gr";
    const { token, otp } = makeToken(email);
    const { POST } = await import("@/app/api/auth/activate/route");
    const res = await POST(req({ email, otp, token }));
    expect(res.status).toBe(503);
  });

  it("marks email_verified in D1", async () => {
    getAuthDbMock.mockReturnValue({ prepare: vi.fn() });
    markEmailVerified.mockResolvedValue(true);

    const email = "user@cloudless.gr";
    const { token, otp } = makeToken(email);
    const { POST } = await import("@/app/api/auth/activate/route");
    const res = await POST(req({ email, otp, token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(markEmailVerified).toHaveBeenCalled();
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

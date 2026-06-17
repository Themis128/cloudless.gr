// @vitest-environment node
/**
 * Unit tests for POST /api/auth/resend-verification
 *
 * Generates a fresh HMAC token+OTP and sends our branded SES email.
 * Always responds { ok: true } to avoid account enumeration.
 * No Cognito SDK call is made — the Cognito mock is intentionally absent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendActivationEmail: vi.fn().mockResolvedValue(undefined),
}));

function req(body: unknown) {
  return new Request("http://localhost/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("always returns 200 with ok and a token", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({ email: "u@b.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; token?: string };
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
    expect((body.token as string).split(".")).toHaveLength(3);
  });

  it("returns 200 without a token when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/resend-verification/route");
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; token?: string };
    expect(body.ok).toBe(true);
    expect(body.token).toBeUndefined();
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
});

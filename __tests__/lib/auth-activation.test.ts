import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { verifyActivationToken, verifyActivationOtp } from "@/lib/auth-activation";

const SECRET = "test-auth-secret";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
});

function makeToken(email: string, ttlMs = 60_000): string {
  const nonce = "abc123";
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", SECRET)
    .update(`${email}:${exp}:${nonce}`)
    .digest("base64url");
  return `${nonce}.${exp}.${sig}`;
}

function makeOtp(email: string, token: string): string {
  const [nonce, expStr] = token.split(".");
  const exp = parseInt(expStr, 10);
  return (
    parseInt(
      createHmac("sha256", SECRET)
        .update(`otp:${email}:${exp}:${nonce}`)
        .digest("hex")
        .slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");
}

describe("verifyActivationToken", () => {
  it("returns true for a valid token", () => {
    const token = makeToken("user@example.com");
    expect(verifyActivationToken("user@example.com", token)).toBe(true);
  });

  it("returns false for an expired token", () => {
    const token = makeToken("user@example.com", -1000);
    expect(verifyActivationToken("user@example.com", token)).toBe(false);
  });

  it("returns false for a token with wrong email", () => {
    const token = makeToken("user@example.com");
    expect(verifyActivationToken("other@example.com", token)).toBe(false);
  });

  it("returns false for a malformed token (wrong segment count)", () => {
    expect(verifyActivationToken("user@example.com", "invalid.token")).toBe(false);
    expect(verifyActivationToken("user@example.com", "too.many.parts.here")).toBe(false);
  });

  it("returns false for tampered signature", () => {
    const token = makeToken("user@example.com");
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifyActivationToken("user@example.com", tampered)).toBe(false);
  });
});

describe("verifyActivationOtp", () => {
  it("returns true for the correct OTP", () => {
    const email = "otp@example.com";
    const token = makeToken(email);
    const otp = makeOtp(email, token);
    expect(verifyActivationOtp(email, otp, token)).toBe(true);
  });

  it("returns false for incorrect OTP", () => {
    const email = "otp@example.com";
    const token = makeToken(email);
    expect(verifyActivationOtp(email, "000000", token)).toBe(false);
  });

  it("returns false when token is invalid", () => {
    expect(verifyActivationOtp("user@example.com", "123456", "bad.token.sig")).toBe(false);
  });
});

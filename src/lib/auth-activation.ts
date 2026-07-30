/**
 * Shared HMAC token + OTP helpers for D1 signup activation / confirmation.
 */
import { createHmac, timingSafeEqual } from "crypto";

function authSecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function verifyActivationToken(email: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;
  const expected = createHmac("sha256", authSecret())
    .update(`${email}:${exp}:${nonce}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyActivationOtp(email: string, otp: string, token: string): boolean {
  if (!verifyActivationToken(email, token)) return false;
  const [nonce, expStr] = token.split(".");
  const exp = parseInt(expStr, 10);
  const expected = (
    parseInt(
      createHmac("sha256", authSecret())
        .update(`otp:${email}:${exp}:${nonce}`)
        .digest("hex")
        .slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");
  const a = Buffer.from(otp.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAuthDbFromEnv, markEmailVerified } from "@/lib/auth-d1";

function verifyToken(email: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const expected = createHmac("sha256", secret)
    .update(`${email}:${exp}:${nonce}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyOtp(email: string, otp: string, token: string): boolean {
  if (!verifyToken(email, token)) return false;
  const [nonce, expStr] = token.split(".");
  const exp = parseInt(expStr, 10);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const expected = (
    parseInt(
      createHmac("sha256", secret).update(`otp:${email}:${exp}:${nonce}`).digest("hex").slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");
  const a = Buffer.from(otp.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/auth/confirm — D1 email verification.
 * Body: { email, code, token } where code is the 6-digit OTP and token is the HMAC payload.
 */
export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-confirm:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let code: string | undefined;
  let token: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; code?: string; token?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    code = typeof body.code === "string" ? body.code.trim() : undefined;
    token = typeof body.token === "string" ? body.token : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !code)
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });

  if (!token)
    return NextResponse.json(
      { error: "token required for D1 confirmation (use /api/auth/activate)" },
      { status: 400 }
    );

  if (!verifyOtp(email, code, token))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const db = getAuthDbFromEnv();
  if (!db) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  const ok = await markEmailVerified(db, email);
  if (!ok) return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });

  return NextResponse.json({ ok: true, provider: "d1" });
}

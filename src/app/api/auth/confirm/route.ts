import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAuthDbFromEnv, markEmailVerified } from "@/lib/auth-d1";
import { verifyActivationOtp } from "@/lib/auth-activation";

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

  if (!verifyActivationOtp(email, code, token))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const db = getAuthDbFromEnv();
  if (!db) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  const ok = await markEmailVerified(db, email);
  if (!ok) return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });

  return NextResponse.json({ ok: true, provider: "d1" });
}

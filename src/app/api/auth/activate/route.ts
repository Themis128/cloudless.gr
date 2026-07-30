import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAuthDbFromEnv, markEmailVerified } from "@/lib/auth-d1";
import { verifyActivationOtp, verifyActivationToken } from "@/lib/auth-activation";

async function confirmUserD1(email: string): Promise<boolean> {
  const db = getAuthDbFromEnv();
  if (!db) return false;
  return markEmailVerified(db, email);
}

/** GET /api/auth/activate?email=...&token=...  — one-tap link from email */
export async function GET(req: NextRequest) {
  const ipRl = rateLimit(`auth-activate:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  const token = searchParams.get("token");

  const origin = new URL(req.url).origin;

  if (!email || !token || !verifyActivationToken(email, token))
    return NextResponse.redirect(`${origin}/en/auth/signup?activated=invalid`);

  const ok = await confirmUserD1(email);
  if (!ok) return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);

  return NextResponse.redirect(`${origin}/en/auth/login?activated=1`);
}

/** POST /api/auth/activate  — OTP code typed manually on mobile */
export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-activate:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let otp: string | undefined;
  let token: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; otp?: string; token?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    otp = body.otp;
    token = body.token;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !otp || !token)
    return NextResponse.json({ error: "email, otp, and token required" }, { status: 400 });

  if (!verifyActivationOtp(email, otp, token))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const ok = await confirmUserD1(email);
  if (!ok) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  return NextResponse.json({ ok: true });
}

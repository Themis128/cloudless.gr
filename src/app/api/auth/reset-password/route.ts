import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken, type AuthDatabase } from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  if (!env.AUTH_DB) {
    return null;
  }
  return env.AUTH_DB;
}

export async function POST(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const ipRl = rateLimit(`auth-reset:ip:${getClientIp(req)}`, 3, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  try {
    const body = (await req.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const result = await createPasswordResetToken(db, email);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Send reset email if user exists
  if (result.token) {
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-confirm?token=${encodeURIComponent(result.token)}`;
    sendPasswordResetEmail(email, resetUrl).catch(() => {});
  }

  // Always return success to prevent enumeration
  return NextResponse.json({ ok: true });
}

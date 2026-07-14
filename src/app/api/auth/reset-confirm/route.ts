import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken, type AuthDatabase } from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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

  const ipRl = rateLimit(`auth-reset-confirm:ip:${getClientIp(req)}`, 5, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let token: string | undefined;
  let newPassword: string | undefined;
  let confirmPassword: string | undefined;
  try {
    const body = (await req.json()) as {
      token?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    token = body.token;
    newPassword = body.newPassword;
    confirmPassword = body.confirmPassword;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!token || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "Token and passwords required" }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const result = await consumePasswordResetToken(db, token, newPassword);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

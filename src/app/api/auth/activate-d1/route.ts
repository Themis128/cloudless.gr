import { NextRequest, NextResponse } from "next/server";
import { type AuthDatabase } from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(_request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  if (!env.AUTH_DB) {
    return null;
  }
  return env.AUTH_DB;
}

async function verifyToken(email: string, token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      keyMaterial,
      new TextEncoder().encode(`${email}:${exp}:${nonce}`)
    )
  );
  const expectedB64 = btoa(String.fromCharCode(...expected))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sigBytes = new TextEncoder().encode(sig);
  const expectedBytes = new TextEncoder().encode(expectedB64);
  if (sigBytes.length !== expectedBytes.length) return false;
  let result = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expectedBytes[i];
  }
  return result === 0;
}

async function verifyOtp(email: string, otp: string, token: string): Promise<boolean> {
  if (!(await verifyToken(email, token))) return false;
  const [nonce, expStr] = token.split(".");
  const exp = parseInt(expStr, 10);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const full = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      keyMaterial,
      new TextEncoder().encode(`otp:${email}:${exp}:${nonce}`)
    )
  );
  const hex = Array.from(full)
    .map((b) => "00".concat(b.toString(16)).slice(-2))
    .join("");
  const expected = (parseInt(hex.slice(0, 8), 16) % 1_000_000).toString().padStart(6, "0");
  const a = otp.trim();
  const b = expected;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function GET(req: NextRequest) {
  const ipRl = rateLimit(`auth-activate:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  const token = searchParams.get("token");

  const base = new URL(req.url);
  const origin = base.origin;

  if (!email || !token || !(await verifyToken(email, token))) {
    return NextResponse.redirect(`${origin}/en/auth/signup?activated=invalid`);
  }

  const db = getDb(req);
  if (!db) {
    return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);
  }

  // Mark user as verified by clearing any unverified flag if present
  try {
    await db
      .prepare(
        "UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.email_verified', 'true') WHERE email = ?"
      )
      .bind(email)
      .run();
  } catch {
    // Non-fatal
  }

  return NextResponse.redirect(`${origin}/en/auth/login?activated=1`);
}

export async function POST(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

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

  if (!email || !otp || !token) {
    return NextResponse.json({ error: "email, otp, and token required" }, { status: 400 });
  }

  if (!(await verifyOtp(email, otp, token))) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  try {
    await db
      .prepare(
        "UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.email_verified', 'true') WHERE email = ?"
      )
      .bind(email)
      .run();
  } catch (err) {
    console.error("[auth/activate-d1] update failed:", err);
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

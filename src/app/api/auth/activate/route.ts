import { NextRequest, NextResponse } from "next/server";
import { type AuthDatabase } from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

async function verifyToken(email: string, token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp) return false;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const expectedBuf = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(`${email}:${exp}:${nonce}`)
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(expectedBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (sig.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < sig.length; i++) {
    result |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

async function verifyOtp(email: string, otp: string, token: string): Promise<boolean> {
  if (!(await verifyToken(email, token))) return false;
  const [nonce, expStr] = token.split(".");
  const exp = parseInt(expStr, 10);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const fullBuf = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(`otp:${email}:${exp}:${nonce}`)
  );
  const hex = Array.from(new Uint8Array(fullBuf))
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

async function confirmUserD1(db: AuthDatabase, email: string): Promise<boolean> {
  try {
    await db.prepare("UPDATE user SET preferences_json = json_set(COALESCE(preferences_json, '{}'), '$.email_verified', 'true') WHERE email = ?").bind(email).run();
    return true;
  } catch (err) {
    console.error("[auth/activate] D1 confirm failed:", err);
    return false;
  }
}

async function confirmUserCognito(userPoolId: string, email: string): Promise<boolean> {
  try {
    const { CognitoIdentityProviderClient, AdminConfirmSignUpCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const issuer = process.env.COGNITO_ISSUER ?? "";
    const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
    const client = new CognitoIdentityProviderClient({ region });
    await client.send(
      new AdminConfirmSignUpCommand({ UserPoolId: userPoolId, Username: email })
    );
    return true;
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "NotAuthorizedException" || name === "InvalidParameterException") return true;
    console.error("[auth/activate] AdminConfirmSignUp failed:", err);
    return false;
  }
}

/** GET /api/auth/activate?email=...&token=...  — one-tap link from email */
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
  if (db) {
    const ok = await confirmUserD1(db, email);
    if (!ok) return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);
  } else {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);
    const ok = await confirmUserCognito(userPoolId, email);
    if (!ok) return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);
  }

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
    const body = (((await req.json()) as any)) as { email?: string; otp?: string; token?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    otp = body.otp;
    token = body.token;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !otp || !token)
    return NextResponse.json({ error: "email, otp, and token required" }, { status: 400 });

  if (!(await verifyOtp(email, otp, token)))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const db = getDb(req);
  if (db) {
    const ok = await confirmUserD1(db, email);
    if (!ok) return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  } else {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    const ok = await confirmUserCognito(userPoolId, email);
    if (!ok) return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac, timingSafeEqual } from "crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function makeClient(): CognitoIdentityProviderClient {
  const issuer = process.env.COGNITO_ISSUER ?? "";
  const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
  return new CognitoIdentityProviderClient({ region });
}

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
  // Must pass full token verification first (HMAC + expiry),
  // then recompute the OTP from the same nonce+exp material.
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

async function confirmUser(userPoolId: string, email: string): Promise<boolean> {
  try {
    await makeClient().send(
      new AdminConfirmSignUpCommand({ UserPoolId: userPoolId, Username: email })
    );
    return true;
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    // Already confirmed — treat as success
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

  // Auth pages are under /[locale]/auth/*, default to /en
  const base = new URL(req.url);
  const origin = base.origin;

  if (!email || !token || !verifyToken(email, token))
    return NextResponse.redirect(`${origin}/en/auth/signup?activated=invalid`);

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) return NextResponse.redirect(`${origin}/en/auth/signup?activated=error`);

  const ok = await confirmUser(userPoolId, email);
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
    const body = (((await req.json()) as any)) as { email?: string; otp?: string; token?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    otp = body.otp;
    token = body.token;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !otp || !token)
    return NextResponse.json({ error: "email, otp, and token required" }, { status: 400 });

  if (!verifyOtp(email, otp, token))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  const ok = await confirmUser(userPoolId, email);
  if (!ok) return NextResponse.json({ error: "Activation failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

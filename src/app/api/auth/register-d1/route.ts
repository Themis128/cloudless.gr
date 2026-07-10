import { NextRequest, NextResponse } from "next/server";
import { createUser, createPasswordResetToken, type AuthDatabase } from "@/lib/auth-d1";
import { sendActivationEmail, notifyTeam, slackRegistrationNotify } from "@/lib/email";
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

  const ipRl = rateLimit(`auth-register:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let password: string | undefined;
  let fullName: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; password?: string; fullName?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    password = body.password;
    fullName = body.fullName;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const emailRl = rateLimit(`auth-register:email:${email}`, 3, 600_000);
  if (!emailRl.ok) return emailRl.response;

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    const result = await createUser(db, email, password, fullName);
    if (result.error) {
      if (result.error === "User already exists") {
        // Always succeed-or-look-like-success to defeat enumeration
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Generate 6-digit OTP for email verification
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const sig = createHmac("sha256", secret)
      .update(`${email}:${exp}:${nonce}`)
      .digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;
    const otp = (
      parseInt(
        createHmac("sha256", secret)
          .update(`otp:${email}:${exp}:${nonce}`)
          .digest("hex")
          .slice(0, 8),
        16
      ) % 1_000_000
    )
      .toString()
      .padStart(6, "0");

    // Fire-and-forget — don't fail signup if SES is down
    sendActivationEmail(email, token, otp, fullName).catch((e) =>
      console.error("[auth/register-d1] activation email failed:", e)
    );

    // Notify team
    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});

    // Return token so client can verify OTP
    return NextResponse.json({ ok: true, token });
  } catch (err: unknown) {
    console.error("[auth/register-d1] error:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

function createHmac(algorithm: string, secret: string): CryptoKey {
  // Use Web Crypto API for HMAC
  const encoder = new TextEncoder();
  const keyMaterial = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm === "sha256" ? "SHA-256" : "SHA-1" },
    false,
    ["sign", "verify"]
  );
  return keyMaterial as unknown as CryptoKey;
}
import { NextRequest, NextResponse } from "next/server";
import { D1Database } from "@cloudflare/workers-types";
import { createHmac, randomBytes } from "crypto";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail, notifyTeam } from "@/lib/email";
import { slackRegistrationNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password-hashing";

declare const AUTH_DB: D1Database;

export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-register:ip:${getClientIp(req)}`, 20, 60_000);
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

  if (!email || !password)
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const emailRl = rateLimit(`auth-register:email:${email}`, 5, 600_000);
  if (!emailRl.ok) return emailRl.response;

  // Check if email already exists in D1
  const existing = await AUTH_DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    console.warn(`[auth/register] enumeration probe blocked for ${JSON.stringify(email)}`);
    return NextResponse.json({ ok: true });
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  // Hash the password
  const hashedPassword = await hashPassword(password);

  try {
    // Create user in D1
    const _userId = await AUTH_DB.prepare(
      "INSERT INTO users (email, password_hash, full_name, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(email, hashedPassword, fullName, new Date().toISOString())
      .run()
      .then((result) => result.lastInsertRowId());

    // Generate activation token
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;

    // Derive OTP from token
    const _otp = (
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

    // Send activation email (fire-and-forget)
    sendActivationEmail(email, token).catch((e) =>
      console.error("[auth/register] activation email failed:", e)
    );

    // Record admin notification
    recordNotification({
      category: "auth",
      type: "info",
      title: "New user sign-up",
      message: `${email} signed up${fullName ? ` (${fullName})` : ""}`,
      actor: email,
      route: "/api/auth/register",
      metadata: { fullName: fullName ?? null },
    });

    // Notify team via Slack and email (fire-and-forget)
    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});

    // Return success with token
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/register] registration failed:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
    return "Password must contain at least one special character";
  return null;
}

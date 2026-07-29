import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import {
  createUser,
  getAuthDbFromEnv,
  validatePasswordStrength,
  validateSessionSecret,
} from "@/lib/auth-d1";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail, notifyTeam } from "@/lib/email";
import { slackRegistrationNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/register — Cloudflare D1 `user` table (auth-d1 schema).
 * Replaces the legacy `users` table path. Cognito Hosted UI remains behind
 * NEXT_PUBLIC_AUTH_PROVIDER=cognito (signup page branches there).
 */
export async function POST(req: NextRequest) {
  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const secretCheck = validateSessionSecret();
  if (!secretCheck.valid) {
    console.warn("[auth/register] SESSION_SECRET validation:", secretCheck.error);
  }

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

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const emailRl = rateLimit(`auth-register:email:${email}`, 5, 600_000);
  if (!emailRl.ok) return emailRl.response;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return NextResponse.json({ error: strength.error }, { status: 400 });
  }

  try {
    const result = await createUser(db, email, password, fullName);
    if (result.error) {
      if (result.error === "User already exists") {
        // Defeat enumeration — look like success
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000;
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;

    sendActivationEmail(email, token).catch((e) =>
      console.error("[auth/register] activation email failed:", e)
    );

    recordNotification({
      category: "auth",
      type: "info",
      title: "New user sign-up",
      message: `${email} signed up${fullName ? ` (${fullName})` : ""}`,
      actor: email,
      route: "/api/auth/register",
      metadata: { fullName: fullName ?? null, provider: "d1" },
    });

    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});

    return NextResponse.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/register] registration failed:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

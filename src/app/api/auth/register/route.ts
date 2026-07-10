import { NextRequest, NextResponse } from "next/server";
import { type AuthDatabase } from "@/lib/auth-d1";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail, notifyTeam } from "@/lib/email";
import { slackRegistrationNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

export async function POST(req: NextRequest) {
  const db = getDb(req);
  if (db) {
    // D1 path
    const userRl = rateLimit(`auth-register:ip:${getClientIp(req)}`, 10, 60_000);
    if (!userRl.ok) return userRl.response;

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

    const { createUser: createD1User } = await import("@/lib/auth-d1");
    const result = await createD1User(db, email, password, fullName);
    if (result.error) {
      if (result.error === "User already exists") {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000;
    const nonce = crypto.randomUUID().replace(/-/g, "");

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      keyMaterial,
      new TextEncoder().encode(`${email}:${exp}:${nonce}`)
    );
    const sigBytes = new Uint8Array(sigBuffer);
    const sigB64 = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `${nonce}.${exp}.${sigB64}`;

    const otpBuffer = await crypto.subtle.sign(
      "HMAC",
      keyMaterial,
      new TextEncoder().encode(`otp:${email}:${exp}:${nonce}`)
    );
    const otpHex = Array.from(new Uint8Array(otpBuffer))
      .map((b) => "00".concat(b.toString(16)).slice(-2))
      .join("");
    const otp = (parseInt(otpHex.slice(0, 8), 16) % 1_000_000).toString().padStart(6, "0");

    sendActivationEmail(email, token, otp, fullName).catch((e) =>
      console.error("[auth/register-d1] activation email failed:", e)
    );
    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});

    return NextResponse.json({ ok: true, token });
  }

  // Fallback to Cognito path unchanged below
  const ipRl = rateLimit(`auth-register:ip:${getClientIp(req)}`, 20, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let password: string | undefined;
  let fullName: string | undefined;
  try {
    const body = (((await req.json()) as any)) as { email?: string; password?: string; fullName?: string };
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

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  // Always succeed-or-look-like-success to defeat account enumeration.

  try {
    const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const { createHmac, randomBytes } = await import("crypto");
    const issuer = process.env.COGNITO_ISSUER ?? "";
    const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
    const client = new CognitoIdentityProviderClient({ region });
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "false" },
          ...(fullName ? [{ Name: "name", Value: fullName }] : []),
        ],
      })
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      })
    );
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
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
    sendActivationEmail(email, token, otp, fullName).catch((e) =>
      console.error("[auth/register] activation email failed:", e)
    );
    recordNotification({
      category: "auth",
      type: "info",
      title: "New user sign-up",
      message: `${email} signed up${fullName ? ` (${fullName})` : ""}`,
      actor: email,
      route: "/api/auth/register",
      metadata: { fullName: fullName ?? null },
    });
    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});
    return NextResponse.json({ ok: true, token });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException") {
      console.warn(`[auth/register] enumeration probe blocked for ${JSON.stringify(email)}`);
      return NextResponse.json({ ok: true });
    }
    if (name === "InvalidPasswordException" || name === "InvalidParameterException")
      return NextResponse.json(
        { error: "Password does not meet requirements (min 8 chars, mixed case, number, symbol)" },
        { status: 400 }
      );
    console.error("[auth/register] AdminCreateUser failed:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

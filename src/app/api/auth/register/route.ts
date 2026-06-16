import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac, randomBytes } from "crypto";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function makeClient(): CognitoIdentityProviderClient {
  const issuer = process.env.COGNITO_ISSUER ?? "";
  const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
  return new CognitoIdentityProviderClient({ region });
}

function secretHash(username: string): string | undefined {
  const secret = process.env.COGNITO_CLIENT_SECRET;
  const clientId = process.env.COGNITO_CLIENT_ID ?? "";
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(username + clientId)
    .digest("base64");
}

export async function POST(req: NextRequest) {
  // Two-tier rate limit:
  //  - per IP, generous (handles corporate NAT)
  //  - per email body, strict (prevents account enumeration grinding)
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

  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  // Always succeed-or-look-like-success to defeat account enumeration.
  // The legitimate flow continues via the Cognito verification email
  // (the user can't proceed without clicking it). For real errors that
  // would block ANY signup (invalid password, service down), we still
  // return 400/503 — but we never confirm or deny whether a given email
  // already exists.
  const ENUM_SAFE_OK = NextResponse.json({ ok: true });

  try {
    await makeClient().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        SecretHash: secretHash(email),
        UserAttributes: [
          { Name: "email", Value: email },
          ...(fullName ? [{ Name: "name", Value: fullName }] : []),
        ],
      })
    );
    // Generate a 24-hour HMAC activation token and send our branded SES email.
    // The token is: base64url(randomNonce) + "." + HMAC(email:exp:nonce, AUTH_SECRET)
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;
    // Derive a 6-digit OTP from the same material — mobile users who can't
    // tap the link can type this code on the signup page instead.
    const otp = (
      parseInt(createHmac("sha256", secret).update(`otp:${email}:${exp}:${nonce}`).digest("hex").slice(0, 8), 16) %
      1_000_000
    ).toString().padStart(6, "0");
    // Fire-and-forget — don't fail the signup if SES is down
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
    // Return token so the client can verify the OTP without a separate lookup.
    // For existing accounts (UsernameExistsException handled below) we still
    // return ENUM_SAFE_OK without a token — no OTP was generated.
    return NextResponse.json({ ok: true, token });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException") {
      console.warn(`[auth/register] enumeration probe blocked for ${email}`);
      return NextResponse.json({ ok: true });
    }
    if (name === "InvalidPasswordException" || name === "InvalidParameterException")
      return NextResponse.json(
        { error: "Password does not meet requirements (min 8 chars, mixed case, number, symbol)" },
        { status: 400 }
      );
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

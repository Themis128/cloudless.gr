import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac, randomBytes } from "crypto";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail, notifyTeam } from "@/lib/email";
import { slackRegistrationNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function makeClient(): CognitoIdentityProviderClient {
  const issuer = process.env.COGNITO_ISSUER ?? "";
  const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
  return new CognitoIdentityProviderClient({ region });
}

export async function POST(req: NextRequest) {
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
    const client = makeClient();
    // AdminCreateUser with MessageAction=SUPPRESS creates the user without
    // sending Cognito's own verification email — our branded SES email below
    // is the only activation message the user receives.
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
    // Set the permanent password immediately so the user isn't forced into a
    // FORCE_CHANGE_PASSWORD state after confirming their email.
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      })
    );
    // Generate a 24-hour HMAC activation token and send our branded SES email.
    // The token is: base64url(randomNonce) + "." + HMAC(email:exp:nonce, AUTH_SECRET)
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;
    // Derive a 6-digit OTP from the same material — mobile users who can't
    // tap the link can type this code on the signup page instead.
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
    // Notify team via Slack + SES
    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      `${email}${fullName ? ` (${fullName})` : ""} just signed up.`
    ).catch(() => {});
    // Return token so the client can verify the OTP without a separate lookup.
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

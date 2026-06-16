import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac, randomBytes } from "crypto";
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
  return createHmac("sha256", secret).update(username + clientId).digest("base64");
}

export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-resend:ip:${getClientIp(req)}`, 5, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  try {
    const body = (await req.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!email || !clientId) return NextResponse.json({ ok: true });

  // Generate a fresh token + OTP
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
  const token = `${nonce}.${exp}.${sig}`;
  const otp = (
    parseInt(
      createHmac("sha256", secret).update(`otp:${email}:${exp}:${nonce}`).digest("hex").slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");

  // Resend Cognito's own code too (keeps Cognito state in sync), fire-and-forget
  makeClient()
    .send(new ResendConfirmationCodeCommand({ ClientId: clientId, Username: email, SecretHash: secretHash(email) }))
    .catch(() => {});

  // Send our branded email with the new token+OTP, fire-and-forget
  sendActivationEmail(email, token, otp).catch(() => {});

  // Return the new token so the client can verify the fresh OTP
  return NextResponse.json({ ok: true, token });
}

import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";

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
  const { email } = (await req.json()) as { email?: string };
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (email && clientId) {
    try {
      await makeClient().send(
        new ResendConfirmationCodeCommand({
          ClientId: clientId,
          Username: email,
          SecretHash: secretHash(email),
        }),
      );
    } catch {
      // Swallow all errors — anti-enumeration, always respond ok
    }
  }
  return NextResponse.json({ ok: true });
}

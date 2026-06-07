import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
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
  return createHmac("sha256", secret)
    .update(username + clientId)
    .digest("base64");
}

export async function POST(req: NextRequest) {
  let email: string | undefined;
  let password: string | undefined;
  let fullName: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; password?: string; fullName?: string };
    email = body.email;
    password = body.password;
    fullName = body.fullName;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password)
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

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
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "UsernameExistsException")
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    if (name === "InvalidPasswordException" || name === "InvalidParameterException")
      return NextResponse.json(
        { error: "Password does not meet requirements (min 8 chars, mixed case, number, symbol)" },
        { status: 400 }
      );
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}

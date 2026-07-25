import { NextRequest, NextResponse } from "next/server";
import {
  ConfirmSignUpCommand,
} from "@/types/aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

  const issuer = process.env.COGNITO_ISSUER ?? "";
  const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
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
  const ipRl = rateLimit(`auth-confirm:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let code: string | undefined;
  try {
    const body = (await req.json()) as any as { email?: string; code?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    code = typeof body.code === "string" ? body.code.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !code)
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });

  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  try {
    await makeClient().send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
        SecretHash: secretHash(email),
      })
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "CodeMismatchException" || name === "ExpiredCodeException")
      return NextResponse.json(
        {
          error:
            name === "ExpiredCodeException" ? "Code expired — request a new one" : "Invalid code",
        },
        { status: 400 }
      );
    if (name === "NotAuthorizedException")
      return NextResponse.json({ error: "Account already confirmed" }, { status: 400 });
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

interface RegisterBody {
  email: string;
  password: string;
  fullName?: string;
}

async function getAdminToken(tokenUrl: string, clientId: string, clientSecret: string) {
  const res = await globalThis.fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Admin token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function POST(req: Request) {
  const rl = rateLimit(`register:${getClientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) {
    return NextResponse.json({ error: "Registration not available" }, { status: 503 });
  }

  // issuer = https://auth.cloudless.gr/realms/master
  const realmMatch = issuer.match(/^(https?:\/\/[^/]+)\/realms\/([^/]+)$/);
  if (!realmMatch) {
    return NextResponse.json({ error: "Registration not available" }, { status: 503 });
  }
  const [, kcBase, realm] = realmMatch;

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password, fullName } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  // Reject malformed emails before they reach the Keycloak Admin API — prevents
  // garbage usernames and stops unvalidated input from driving send-verify-email.
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const config = await getConfig();
  if (!config.KEYCLOAK_ADMIN_CLIENT_ID || !config.KEYCLOAK_ADMIN_CLIENT_SECRET) {
    return NextResponse.json({ error: "Registration not available" }, { status: 503 });
  }

  try {
    const adminToken = await getAdminToken(
      `${issuer}/protocol/openid-connect/token`,
      config.KEYCLOAK_ADMIN_CLIENT_ID,
      config.KEYCLOAK_ADMIN_CLIENT_SECRET
    );

    const parts = (fullName ?? "").trim().split(" ").filter(Boolean);
    const userRep: Record<string, unknown> = {
      email,
      username: email,
      enabled: true,
      emailVerified: false,
      requiredActions: ["VERIFY_EMAIL"],
      credentials: [{ type: "password", value: password, temporary: false }],
    };
    if (parts[0]) userRep.firstName = parts[0];
    if (parts.length > 1) userRep.lastName = parts.slice(1).join(" ");

    const createRes = await globalThis.fetch(`${kcBase}/admin/realms/${realm}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userRep),
      signal: AbortSignal.timeout(10_000),
    });

    if (createRes.status === 409) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    if (!createRes.ok) {
      return NextResponse.json({ error: "Registration failed" }, { status: 400 });
    }

    // Send verification email via the app client so the link returns to cloudless.gr
    const userId = createRes.headers.get("Location")?.split("/").pop();
    if (userId) {
      const appClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const params = new URLSearchParams({ client_id: appClientId });
      if (siteUrl) params.set("redirect_uri", `${siteUrl}/api/auth/callback/keycloak`);
      // Best-effort: if SMTP is not yet configured the email silently fails;
      // the VERIFY_EMAIL required action still blocks sign-in until verified.
      await globalThis
        .fetch(
          `${kcBase}/admin/realms/${realm}/users/${userId}/send-verify-email?${params.toString()}`,
          { method: "PUT", headers: { Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(8_000) }
        )
        .catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/register]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

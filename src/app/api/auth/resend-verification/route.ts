import { NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/resend-verification
 *
 * Re-sends the Keycloak account-verification email for a not-yet-verified user.
 * Without this, a user created by /api/auth/register who never received the
 * first email (e.g. SMTP hiccup) is permanently stuck — the VERIFY_EMAIL
 * required action blocks sign-in and there was no way to re-trigger the send.
 *
 * To avoid account enumeration this always responds { ok: true } regardless of
 * whether the email maps to an existing/unverified user.
 */
interface ResendBody {
  email: string;
}

const UNAVAILABLE = NextResponse.json({ error: "Not available" }, { status: 503 });

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

/** Best-effort: find an unverified user by email and re-send the verify email. */
async function resendForEmail(
  kcBase: string,
  realm: string,
  adminToken: string,
  email: string
): Promise<void> {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const searchRes = await globalThis.fetch(
    `${kcBase}/admin/realms/${realm}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: auth, signal: AbortSignal.timeout(10_000) }
  );
  if (!searchRes.ok) return;

  const users = (await searchRes.json()) as Array<{ id: string; emailVerified?: boolean }>;
  const user = users[0];
  // Only re-send when the account exists and is still unverified.
  if (!user || user.emailVerified) return;

  const appClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const params = new URLSearchParams({ client_id: appClientId });
  if (siteUrl) params.set("redirect_uri", `${siteUrl}/api/auth/callback/keycloak`);

  await globalThis
    .fetch(
      `${kcBase}/admin/realms/${realm}/users/${user.id}/send-verify-email?${params.toString()}`,
      { method: "PUT", headers: auth, signal: AbortSignal.timeout(8_000) }
    )
    .catch(() => {});
}

export async function POST(req: Request) {
  const rl = rateLimit(`resend-verify:${getClientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) return UNAVAILABLE;
  const realmMatch = issuer.match(/^(https?:\/\/[^/]+)\/realms\/([^/]+)$/);
  if (!realmMatch) return UNAVAILABLE;
  const [, kcBase, realm] = realmMatch;

  let body: ResendBody;
  try {
    body = (await req.json()) as ResendBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const config = await getConfig();
  if (!config.KEYCLOAK_ADMIN_CLIENT_ID || !config.KEYCLOAK_ADMIN_CLIENT_SECRET) {
    return UNAVAILABLE;
  }

  try {
    const adminToken = await getAdminToken(
      `${issuer}/protocol/openid-connect/token`,
      config.KEYCLOAK_ADMIN_CLIENT_ID,
      config.KEYCLOAK_ADMIN_CLIENT_SECRET
    );
    await resendForEmail(kcBase, realm, adminToken, body.email);
  } catch (err) {
    // Log but still return ok — never reveal whether the address exists, and
    // the caller can't act on an internal failure anyway.
    console.error(
      "[auth/resend-verification]",
      err instanceof Error ? err.message : String(err)
    );
  }

  return NextResponse.json({ ok: true });
}

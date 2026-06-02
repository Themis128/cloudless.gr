import { NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAdminToken, parseRealm, sendVerifyEmail } from "@/lib/keycloak-admin";

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

/** Best-effort: find an unverified user by email and re-send the verify email. */
async function resendForEmail(
  kcBase: string,
  realm: string,
  adminToken: string,
  email: string
): Promise<void> {
  const searchRes = await globalThis.fetch(
    `${kcBase}/admin/realms/${realm}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(10_000) }
  );
  if (!searchRes.ok) return;

  const users = (await searchRes.json()) as Array<{ id: string; emailVerified?: boolean }>;
  const user = users[0];
  // Only re-send when the account exists and is still unverified.
  if (!user || user.emailVerified) return;

  await sendVerifyEmail(kcBase, realm, adminToken, user.id).catch(() => {});
}

export async function POST(req: Request) {
  const rl = rateLimit(`resend-verify:${getClientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) return UNAVAILABLE;
  const realm = parseRealm(issuer);
  if (!realm) return UNAVAILABLE;

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
    await resendForEmail(realm.kcBase, realm.realm, adminToken, body.email);
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

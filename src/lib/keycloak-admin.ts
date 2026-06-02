/**
 * Shared Keycloak Admin REST helpers used by the email-bound auth routes
 * (register, resend-verification). Centralised so the client_credentials token
 * exchange and the verify-email trigger live in one place (no duplication).
 */

/** Split a Keycloak issuer URL (`https://host/realms/<realm>`) into base + realm. */
export function parseRealm(issuer: string): { kcBase: string; realm: string } | null {
  const m = issuer.match(/^(https?:\/\/[^/]+)\/realms\/([^/]+)$/);
  if (!m) return null;
  return { kcBase: m[1], realm: m[2] };
}

/** Obtain an admin access token via the client_credentials grant. */
export async function getAdminToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
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

/**
 * Query string for send-verify-email: the verification link returns to the app
 * (cloudless.gr) via the app client, not Keycloak's default account console.
 */
function verifyEmailParams(): string {
  const appClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "cloudless-app";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const params = new URLSearchParams({ client_id: appClientId });
  if (siteUrl) params.set("redirect_uri", `${siteUrl}/api/auth/callback/keycloak`);
  return params.toString();
}

/**
 * Trigger Keycloak's verification email for a user. Callers decide how to treat
 * failure (both current callers are best-effort and swallow errors, since the
 * VERIFY_EMAIL required action still blocks sign-in until the user verifies).
 */
export async function sendVerifyEmail(
  kcBase: string,
  realm: string,
  adminToken: string,
  userId: string
): Promise<void> {
  await globalThis.fetch(
    `${kcBase}/admin/realms/${realm}/users/${userId}/send-verify-email?${verifyEmailParams()}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(8_000),
    }
  );
}

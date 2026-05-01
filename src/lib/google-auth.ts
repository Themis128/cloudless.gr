import { getConfig } from "@/lib/ssm-config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Returns a getAccessToken() function scoped to the given OAuth2 scope.
 * The returned function caches the token in a closure and auto-refreshes
 * 60 seconds before expiry, so it is safe to call on every request.
 *
 * Usage:
 *   const getToken = createGoogleAuth("https://www.googleapis.com/auth/calendar");
 *   const token = await getToken();
 */
export function createGoogleAuth(scope: string): () => Promise<string> {
  let cached: { token: string; expires: number } | null = null;

  return async function getAccessToken(): Promise<string> {
    if (cached && Date.now() < cached.expires) return cached.token;

    const config = await getConfig();
    const email = config.GOOGLE_CLIENT_EMAIL;
    const key = config.GOOGLE_PRIVATE_KEY;
    if (!email || !key) throw new Error("Google service account not configured");

    const { SignJWT, importPKCS8 } = await import("jose");
    const now = Math.floor(Date.now() / 1000);
    const privateKey = await importPKCS8(key, "RS256");

    const jwt = await new SignJWT({ iss: email, scope, aud: TOKEN_URL })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) throw new Error(`Google token error: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };

    cached = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in - 60) * 1000,
    };

    return cached.token;
  };
}

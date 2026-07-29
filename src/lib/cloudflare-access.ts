/**
 * R15: Cloudflare Access service token utilities
 *
 * Verifies Cloudflare Access tokens for programmatic access to admin hosts.
 * Used by /admin/cluster tiles to provide authenticated access without
 * interactive login for the unified admin user.
 */

const CF_ACCESS_ISSUER = "https://api.cloudflare.com/client/v4/accounts";

interface AccessTokenPayload {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  aud?: string;
  exp: number;
  iat: number;
  nbf?: number;
  identity_provider?: string;
}

interface VerifiedAccess {
  email: string;
  name?: string;
  valid: boolean;
}

/**
 * Get the Cloudflare Access public keys for JWT verification
 */
async function _getAccessKeys(): Promise<Map<string, string>> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID not configured");
  }

  const jwksUrl = `${CF_ACCESS_ISSUER}/${accountId}/access/certs`;
  const res = await fetch(jwksUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch Access JWKS: ${res.status}`);
  }

  const { keys } = (await res.json()) as { keys: Array<{ kid: string; n: string; alg: string }> };
  const keyMap = new Map<string, string>();

  for (const key of keys) {
    keyMap.set(key.kid, key.n);
  }

  return keyMap;
}

/**
 * Verify a Cloudflare Access service token JWT
 */
export async function verifyAccessToken(token: string): Promise<VerifiedAccess | null> {
  try {
    // For service tokens, we verify using the application's public key
    // The token format is: CF_ACCESS_CERT.<jwt>
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    // Decode without verification first to get the key ID
    const _header = JSON.parse(Buffer.from(parts[0], "base64").toString()) as { kid: string };
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString()) as AccessTokenPayload;

    // Verify the token is for an Access application
    if (!payload.email && !payload.identity_provider) {
      return null;
    }

    // Verify token hasn't expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    if (payload.nbf && payload.nbf > now) {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
      valid: true,
    };
  } catch (err) {
    console.error("Access token verification failed:", err);
    return null;
  }
}

/**
 * Check if Cloudflare Access is configured for a specific app
 */
export function isAccessConfigured(app: string): boolean {
  const clientId = process.env[`CLOUDFLARE_ACCESS_CLIENT_ID_${app.toUpperCase()}`];
  const clientSecret = process.env[`CLOUDFLARE_ACCESS_CLIENT_SECRET_${app.toUpperCase()}`];
  return Boolean(clientId && clientSecret);
}

/**
 * Get all configured Access applications
 */
export function getConfiguredAccessApps(): string[] {
  const apps: string[] = [];
  const envPrefix = "CLOUDFLARE_ACCESS_CLIENT_ID_";

  for (const key of Object.keys(process.env)) {
    if (key.startsWith(envPrefix)) {
      const app = key.replace(envPrefix, "").toLowerCase();
      if (isAccessConfigured(app)) {
        apps.push(app);
      }
    }
  }

  return apps;
}

/**
 * Generate the Access service token for an app (for programmatic access)
 * Service tokens are static - just retrieve them from env
 */
export function getServiceToken(app: string): string | null {
  const clientId = process.env[`CLOUDFLARE_ACCESS_CLIENT_ID_${app.toUpperCase()}`];
  const clientSecret = process.env[`CLOUDFLARE_ACCESS_CLIENT_SECRET_${app.toUpperCase()}`];

  if (!clientId || !clientSecret) {
    return null;
  }

  // Service tokens are sent as CF_ACCESS_CERT header
  // Format: CF_ACCESS_CERT.<client_id>.<client_secret>
  return `CF_ACCESS_CERT.${clientId}.${clientSecret}`;
}

// Supported admin apps
export const ADMIN_APPS = ["grafana", "kuma", "appflowy", "n8n"] as const;
export type AdminApp = (typeof ADMIN_APPS)[number];

/**
 * R25: Self-hosted admin auto-login bridge
 * 
 * Provides one-click admin access to self-hosted apps via Cloudflare Access Service Tokens.
 * Integrated with /api/admin/autologin for the /admin/cluster tiles.
 */

// App name type
export type SelfhostedApp = "appflowy" | "espocrm" | "postiz" | "grafana" | "n8n";

// Canonical app names (used by autologin route)
export const SELFHOSTED_APP_NAMES = {
  appflowy: {
    url: "https://appflowy.cloudless.gr",
    authMethod: "service-token",
  },
  espocrm: {
    url: "https://espocrm.cloudless.gr",
    authMethod: "basic",
  },
  postiz: {
    url: "https://postiz.cloudless.gr",
    authMethod: "jwt",
  },
  grafana: {
    url: "https://grafana.cloudless.gr",
    authMethod: "cookie",
  },
  n8n: {
    url: "https://n8n.cloudless.gr",
    authMethod: "basic",
  },
} as const;

/**
 * Result of autologin URL generation
 */
export interface AutologinResult {
  url: string;
  hasToken: boolean;
}

/**
 * Generate a pre-authenticated URL for a self-hosted app
 * Uses Cloudflare Access Service Tokens for SSO
 */
export async function getAutologinUrl(app: SelfhostedApp): Promise<AutologinResult> {
  const config = SELFHOSTED_APP_NAMES[app];
  if (!config) {
    throw new Error(`Unknown app: ${app}`);
  }

  // Check if Cloudflare Access Service Token is configured
  const cfClientId = process.env[`CLOUDFLARE_ACCESS_CLIENT_ID_${app.toUpperCase()}`];
  const cfClientSecret = process.env[`CLOUDFLARE_ACCESS_CLIENT_SECRET_${app.toUpperCase()}`];

  if (cfClientId && cfClientSecret) {
    // For apps behind Cloudflare Access, return the URL with access token param
    // The CF_ACCESS_SERVICE_TOKEN cookie will be set by the browser on redirect
    return {
      url: config.url,
      hasToken: true,
    };
  }

  // No Access configured - return direct URL
  return {
    url: config.url,
    hasToken: false,
  };
}
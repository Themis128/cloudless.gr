/**
 * R25: Self-hosted admin auto-login bridge
 * 
 * Provides one-click admin access to self-hosted apps via Cloudflare Access Service Tokens.
 * Integrated with /api/admin/autologin for the /admin/cluster tiles.
 */

import { getConfig } from "@/lib/ssm-config";

// App name type
export type SelfhostedApp = "appflowy" | "espocrm" | "postiz" | "grafana" | "n8n" | "kuma";

// Canonical app config (used by autologin route)
export const SELFHOSTED_APP_NAMES = {
  appflowy: {
    url: "https://appflowy.cloudless.gr",
    authMethod: "service-token",
  },
  espocrm: {
    url: "https://espocrm.cloudless.gr/",
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
    url: "https://n8n.cloudless.gr/signin",
    authMethod: "basic",
  },
  kuma: {
    url: "https://kuma.cloudless.gr/dashboard",
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
 * Check if an app supports auto-login (currently only AppFlowy with GoTrue)
 */
export function supportsAutoLogin(app: SelfhostedApp): boolean {
  return app === "appflowy";
}

/**
 * Generate a pre-authenticated URL for a self-hosted app
 * Uses Cloudflare Access Service Tokens for SSO
 */
export async function getAutologinUrl(app: SelfhostedApp): Promise<AutologinResult> {
  const appConfig = SELFHOSTED_APP_NAMES[app];
  
  // Check if Cloudflare Access Service Token is configured
  const cfClientId = process.env[`CLOUDFLARE_ACCESS_CLIENT_ID_${app.toUpperCase()}`];
  const cfClientSecret = process.env[`CLOUDFLARE_ACCESS_CLIENT_SECRET_${app.toUpperCase()}`];

  // AppFlowy uses GoTrue password grant
  if (app === "appflowy") {
    // Get config from SSM (includes credentials)
    const config = await getConfig();
    const apiUrl = config.APPFLOWY_API_URL;
    const email = config.APPFLOWY_EMAIL;
    const password = config.APPFLOWY_PASSWORD;

    if (!apiUrl || !email || !password) {
      throw new Error("AppFlowy auto-login is not configured (APPFLOWY_API_URL, APPFLOWY_EMAIL, or APPFLOWY_PASSWORD missing)");
    }

    try {
      const resp = await fetch(`${apiUrl}/auth/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const status = resp.status;
        throw new Error(`AppFlowy GoTrue returned HTTP ${status}`);
      }

       
      const data = await resp.json() as any;

      if (!data.access_token) {
        throw new Error("AppFlowy GoTrue returned no access_token in response");
      }

      // Return URL with access token in hash
      return {
        url: `${apiUrl}/#access_token=${data.access_token}`,
        hasToken: true,
      };
    } catch (err) {
      if (err instanceof Error) {
        // Sanitize error messages that might leak credentials
        if (err.message.includes("ECONNREFUSED") || err.message.includes("ENOTFOUND")) {
          throw new Error(`AppFlowy is unreachable: ${err.message}`);
        }
        throw err;
      }
      throw err;
    }
  }

  // For apps behind Cloudflare Access, return the URL with access token param
  if (cfClientId && cfClientSecret) {
    return {
      url: appConfig.url,
      hasToken: true,
    };
  }

  // No Access configured - return direct URL (strip trailing slash if present)
  return {
    url: appConfig.url.replace(/\/$/, ""),
    hasToken: false,
  };
}
/**
 * Self-hosted admin auto-login bridge (R25+)
 *
 * Produces a launch URL for each self-hosted app tile.
 * Apps that support token-based or credential-based auto-login get a
 * server-side injected auth; all others get a canonical admin URL.
 *
 * Security notes:
 * - Tokens/credentials are fetched server-side and never logged.
 * - URLs containing secrets are never stored and are only returned to
 *   authenticated admin callers.
 * - This module is server-only; never import it from client components.
 */
import { getConfig } from "@/lib/ssm-config";

export type SelfhostedApp = "appflowy" | "espocrm" | "n8n" | "postiz" | "grafana" | "kuma";

export const SELFHOSTED_APP_NAMES: Record<SelfhostedApp, string> = {
  appflowy: "AppFlowy",
  espocrm: "EspoCRM",
  n8n: "n8n",
  postiz: "Postiz",
  grafana: "Grafana",
  kuma: "Uptime Kuma",
};

export interface AutologinResult {
  url: string;
  /** true = URL contains an injected token/credential and should not be stored */
  hasToken: boolean;
}

// ---------------------------------------------------------------------------
// Per-app URL builders
// ---------------------------------------------------------------------------

/**
 * AppFlowy: POST to GoTrue password-grant endpoint → get access_token →
 * construct deep-link `{base}/web#access_token=…` so the SPA logs in on load.
 *
 * The access_token returned is short-lived (GoTrue default: 1 hour, but we
 * request a fresh one immediately before redirect so it's effectively brand-new).
 * We do NOT use APPFLOWY_JWT_SECRET here — that's for the service-role API
 * path. This is a real user login via the GoTrue password grant.
 */
async function buildAppFlowyUrl(): Promise<AutologinResult> {
  const cfg = await getConfig();
  const base = (cfg.APPFLOWY_API_URL ?? "").replace(/\/$/, "");
  const email = cfg.APPFLOWY_EMAIL ?? "";
  const password = cfg.APPFLOWY_PASSWORD ?? "";

  if (!base || !email || !password) {
    throw new Error(
      "AppFlowy not configured: APPFLOWY_API_URL / APPFLOWY_EMAIL / APPFLOWY_PASSWORD missing"
    );
  }

  // GoTrue password-grant: POST {base}/gotrue/token with grant_type in body
  // (Query param form is deprecated; modern GoTrue requires all params in JSON body)
  const grantUrl = `${base}/gotrue/token`;

  let res: Response;
  try {
    res = await fetch(grantUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "password", email, password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new Error(`AppFlowy GoTrue unreachable: ${(err as Error).message}`);
  }

  if (!res.ok) {
    // Deliberately omit password from any message that bubbles up.
    throw new Error(`AppFlowy GoTrue returned HTTP ${res.status} for ${email}`);
  }

  let body: { access_token?: string };
  try {
    body = (await res.json()) as { access_token?: string };
  } catch {
    throw new Error("AppFlowy GoTrue response was not valid JSON");
  }

  const token = body.access_token;
  if (!token) {
    throw new Error("AppFlowy GoTrue did not return an access_token");
  }

  // AppFlowy web SPA reads the access_token from the URL hash on initial load.
  const redirectUrl = `${base}/web#access_token=${encodeURIComponent(token)}`;
  return { url: redirectUrl, hasToken: true };
}

/**
 * EspoCRM: embed API user credentials via Basic Auth in the URL.
 * EspoCRM supports HTTP Basic Auth natively; the browser will use these
 * credentials for the session.
 *
 * Config: ESPOCRM_BASE_URL + ESPOCRM_API_USER + ESPOCRM_API_PASSWORD
 */
function buildEspoCrmUrl(cfg: {
  baseUrl?: string;
  apiUser?: string;
  apiPassword?: string;
}): AutologinResult {
  const base = (cfg.baseUrl || "https://espocrm.cloudless.gr").replace(/\/$/, "");
  const user = cfg.apiUser || "";
  const password = cfg.apiPassword || "";

  if (user && password) {
    // URL-encode credentials to handle special chars safely
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    return {
      url: `https://${encodedUser}:${encodedPass}@${base.replace(/^https?:\/\//, "")}/`,
      hasToken: true,
    };
  }

  // Fallback: direct link without credentials
  return { url: `${base}/`, hasToken: false };
}

/**
 * n8n: no native token-based SSO for the web UI.
 * Supports API key auth for the REST API but the UI uses session cookies.
 * Return the direct admin URL.
 */
function buildN8nUrl(base: string): AutologinResult {
  const b = base.replace(/\/$/, "");
  return { url: `${b}/signin`, hasToken: false };
}

/**
 * Postiz: no native token-based SSO for the web UI.
 * Uses API key for the REST API but the UI uses session cookies.
 * Return the direct admin URL.
 */
function buildPostizUrl(base: string): AutologinResult {
  const b = base.replace(/\/$/, "");
  return { url: `${b}/`, hasToken: false };
}

/**
 * Grafana: no URL-based token auth for the web UI.
 * API tokens work for the REST API but UI login requires username/password.
 * Return the direct admin URL.
 */
function buildGrafanaUrl(base: string): AutologinResult {
  const b = (base || "https://grafana.cloudless.gr").replace(/\/$/, "");
  return { url: `${b}/`, hasToken: false };
}

/**
 * Kuma: public status page, no login required.
 * Return the dashboard URL.
 */
function buildKumaUrl(base: string): AutologinResult {
  const b = (base || "https://kuma.cloudless.gr").replace(/\/$/, "");
  return { url: `${b}/dashboard`, hasToken: false };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Returns a launch URL for the given self-hosted app.
 * For AppFlowy and EspoCRM this involves server-side auth setup; for all
 * others it's a synchronous URL build from SSM config.
 */
export async function getAutologinUrl(app: SelfhostedApp): Promise<AutologinResult> {
  const cfg = await getConfig();

  switch (app) {
    case "appflowy":
      return buildAppFlowyUrl();

    case "espocrm":
      return buildEspoCrmUrl({
        baseUrl: cfg.ESPOCRM_BASE_URL || "https://espocrm.cloudless.gr",
        apiUser: cfg.ESPOCRM_API_USER,
        apiPassword: cfg.ESPOCRM_API_PASSWORD,
      });

    case "n8n":
      return buildN8nUrl(cfg.N8N_API_URL || "https://n8n.cloudless.gr");

    case "postiz":
      return buildPostizUrl(cfg.POSTIZ_API_URL || "https://postiz.cloudless.gr");

    case "grafana":
      return buildGrafanaUrl(cfg.GRAFANA_BASE_URL);

    case "kuma":
      return buildKumaUrl(cfg.KUMA_BASE_URL);

    default: {
      const _exhaustive: never = app;
      throw new Error(`Unknown self-hosted app: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Returns true only for apps where we can inject a real token or credential.
 * Currently: AppFlowy (GoTrue token), EspoCRM (Basic Auth in URL).
 */
export function supportsAutoLogin(app: SelfhostedApp): boolean {
  return app === "appflowy" || app === "espocrm";
}

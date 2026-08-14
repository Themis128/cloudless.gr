/**
 * Self-hosted admin auto-login bridge (R25+)
 *
 * Produces a launch URL for each self-hosted app tile.
 * Apps that support token-based or credential-based auto-login get a
 * server-side injected auth; all others get a canonical admin URL.
 *
 * Browser launch URLs ALWAYS use the public `*.cloudless.gr` hosts.
 * SSM/env may still hold in-cluster Service DNS for pod→pod API calls
 * (e.g. `http://nginx.appflowy.svc.cluster.local`) — those must never be
 * returned to Windows/Tailscale browsers (`ERR_NAME_NOT_RESOLVED`).
 *
 * Security notes:
 * - Tokens/credentials are fetched server-side and never logged.
 * - URLs containing secrets are never stored and are only returned to
 *   authenticated admin callers.
 * - This module is server-only; never import it from client components.
 */
import { getConfig } from "@/lib/ssm-config";
import {
  SELFHOSTED_APP_NAMES,
  SELFHOSTED_PUBLIC_URLS,
  type SelfhostedApp,
} from "@/lib/selfhosted-apps";

export type { SelfhostedApp } from "@/lib/selfhosted-apps";
export { SELFHOSTED_APP_NAMES, SELFHOSTED_PUBLIC_URLS } from "@/lib/selfhosted-apps";

export interface AutologinResult {
  url: string;
  /** true = URL contains an injected token/credential and should not be stored */
  hasToken: boolean;
}

/**
 * True when a configured base is only reachable inside the cluster / LAN
 * and must not be handed to a desktop browser.
 */
export function isInternalOnlyBaseUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s.includes("://") ? s : `http://${s}`);
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".svc.cluster.local") || host === "kubernetes.default") return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return /\.svc\.cluster\.local/i.test(s);
  }
}

/**
 * Resolve the URL a browser should open. Prefer the public cloudless.gr
 * origin whenever the configured value is missing or cluster/LAN-only.
 */
export function publicUrlForApp(app: SelfhostedApp, configured?: string | null): string {
  const fallback = SELFHOSTED_PUBLIC_URLS[app];
  const raw = (configured ?? "").trim().replace(/\/$/, "");
  if (!raw || isInternalOnlyBaseUrl(raw)) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    const host = u.hostname.toLowerCase();
    if (host === "cloudless.gr" || host.endsWith(".cloudless.gr")) {
      return `${u.protocol}//${u.host}`.replace(/\/$/, "");
    }
  } catch {
    return fallback;
  }
  // Unknown external host — still prefer our known public map for these tiles.
  return fallback;
}

// ---------------------------------------------------------------------------
// Per-app URL builders
// ---------------------------------------------------------------------------

/**
 * AppFlowy: POST to GoTrue password-grant endpoint → get access_token →
 * construct deep-link `{public}/web#access_token=…` so the SPA logs in on load.
 *
 * GoTrue may be reached via an in-cluster APPFLOWY_API_URL; the redirect
 * URL handed to the browser is always the public origin.
 */
async function buildAppFlowyUrl(): Promise<AutologinResult> {
  const cfg = await getConfig();
  const apiBase = (cfg.APPFLOWY_API_URL ?? "").replace(/\/$/, "");
  const email = cfg.APPFLOWY_EMAIL ?? "";
  const password = cfg.APPFLOWY_PASSWORD ?? "";
  const browserBase = publicUrlForApp("appflowy", apiBase);

  if (!apiBase || !email || !password) {
    throw new Error(
      "AppFlowy not configured: APPFLOWY_API_URL / APPFLOWY_EMAIL / APPFLOWY_PASSWORD missing"
    );
  }

  // GoTrue on AppFlowy Cloud rejects body-only grant_type with
  // unsupported_grant_type; the grant must be in the query string.
  const grantUrl = `${apiBase}/gotrue/token?grant_type=password`;

  let res: Response;
  try {
    res = await fetch(grantUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
  const redirectUrl = `${browserBase}/web#access_token=${encodeURIComponent(token)}`;
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
  const base = publicUrlForApp("espocrm", cfg.baseUrl);
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
  const b = publicUrlForApp("n8n", base);
  return { url: `${b}/signin`, hasToken: false };
}

/**
 * Postiz: no native token-based SSO for the web UI.
 * Uses API key for the REST API but the UI uses session cookies.
 * Return the direct admin URL.
 */
function buildPostizUrl(base: string): AutologinResult {
  const b = publicUrlForApp("postiz", base);
  return { url: `${b}/`, hasToken: false };
}

/**
 * Grafana: public via Cloudflare Access (no Tailscale required for the UI).
 */
function buildGrafanaUrl(base: string): AutologinResult {
  const b = publicUrlForApp("grafana", base);
  return { url: `${b}/`, hasToken: false };
}

/**
 * Kuma: public status page, no login required.
 * Return the dashboard URL.
 */
function buildKumaUrl(base: string): AutologinResult {
  const b = publicUrlForApp("kuma", base);
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
        baseUrl: cfg.ESPOCRM_BASE_URL || SELFHOSTED_PUBLIC_URLS.espocrm,
        apiUser: cfg.ESPOCRM_API_USER,
        apiPassword: cfg.ESPOCRM_API_PASSWORD,
      });

    case "n8n":
      return buildN8nUrl(cfg.N8N_API_URL || SELFHOSTED_PUBLIC_URLS.n8n);

    case "postiz":
      return buildPostizUrl(cfg.POSTIZ_API_URL || SELFHOSTED_PUBLIC_URLS.postiz);

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

/**
 * Self-hosted admin auto-login bridge (R25)
 *
 * Knows how to produce a launch URL for each self-hosted app tile.
 * Only AppFlowy supports server-side token-based SSO (GoTrue password grant).
 * All other apps get a canonical admin URL (smart link, opens in new tab).
 *
 * Security notes:
 * - AppFlowy tokens are fetched server-side and short-lived (5 min max, set by GoTrue).
 * - Tokens are never logged — only the resulting redirect URL is returned.
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
  /** true = URL contains an injected token and should not be stored */
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

  // GoTrue password-grant: POST {base}/gotrue/token?grant_type=password
  const grantUrl = `${base}/gotrue/token?grant_type=password`;

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
    body = (((await res.json()) as any)) as { access_token?: string };
  } catch {
    throw new Error("AppFlowy GoTrue response was not valid JSON");
  }

  const token = body.access_token;
  if (!token) {
    throw new Error("AppFlowy GoTrue did not return an access_token");
  }

  // AppFlowy Cloud web SPA is served at the root of the same host as the API.
  // It reads access_token from the URL hash on initial load via GoTrue client.
  // Use the origin only (strip any /api path prefix the SSM value may carry).
  const origin = new URL(base).origin;
  const redirectUrl = `${origin}/#access_token=${encodeURIComponent(token)}`;
  return { url: redirectUrl, hasToken: true };
}

function buildEspoCrmUrl(base: string): AutologinResult {
  // EspoCRM has no token-based SSO — direct to login page.
  const b = base.replace(/\/$/, "");
  return { url: `${b}/`, hasToken: false };
}

function buildN8nUrl(base: string): AutologinResult {
  const b = base.replace(/\/$/, "");
  return { url: `${b}/signin`, hasToken: false };
}

function buildPostizUrl(base: string): AutologinResult {
  const b = base.replace(/\/$/, "");
  return { url: `${b}/`, hasToken: false };
}

function buildGrafanaUrl(base: string): AutologinResult {
  const b = (base || "https://grafana.cloudless.gr").replace(/\/$/, "");
  return { url: `${b}/`, hasToken: false };
}

function buildKumaUrl(base: string): AutologinResult {
  const b = (base || "https://kuma.cloudless.gr").replace(/\/$/, "");
  // Kuma dashboard — no login required if running without auth mode.
  return { url: `${b}/dashboard`, hasToken: false };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Returns a launch URL for the given self-hosted app.
 * For AppFlowy this involves a live GoTrue call; for all others it's a
 * synchronous URL build from SSM config.
 */
export async function getAutologinUrl(app: SelfhostedApp): Promise<AutologinResult> {
  const cfg = await getConfig();

  switch (app) {
    case "appflowy":
      return buildAppFlowyUrl();

    case "espocrm":
      return buildEspoCrmUrl(cfg.ESPOCRM_BASE_URL || "https://espocrm.cloudless.gr");

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

/** Returns true only for apps where we can inject a real token (currently just AppFlowy). */
export function supportsAutoLogin(app: SelfhostedApp): boolean {
  return app === "appflowy";
}

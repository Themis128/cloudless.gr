import "server-only";

import { getConfig } from "@/lib/ssm-config";
import { splitServiceToken, type CfAccessCreds } from "@/lib/upstream-client";

/**
 * Server-side forwarder for the public lead forms (playbook + audit).
 *
 * All of social.cloudless.gr (SocialAuto) sits behind Cloudflare Access, so
 * the browser never talks to it. The cloudless.gr forms post to
 * `/api/playbook-lead` / `/api/audit`, which call SocialAuto's
 * `POST /api/v1/leads/public` server-to-server with a Cloudflare Access
 * **service token** (`Cf-Access-Client-Id` / `Cf-Access-Client-Secret`).
 * SocialAuto stores the lead and queues the follow-up Celery task.
 *
 * Config (D1 `app_config` / SSM / env — same keys as `socialauto.ts`):
 *   SOCIALAUTO_LEADS_URL           — full endpoint override (optional)
 *   SOCIALAUTO_API_URL             — base URL, default https://social.cloudless.gr
 *   SOCIALAUTO_SERVICE_TOKEN       — CF Access client secret, or "client_id:client_secret"
 *   SOCIALAUTO_CF_ACCESS_CLIENT_ID — CF Access client id (when the token is the bare secret)
 *
 * Without the service token the forwarder is inert and reports
 * `not_configured` — it never calls the Access-protected host unauthenticated.
 */

const DEFAULT_BASE_URL = "https://social.cloudless.gr";
const LEADS_PATH = "/api/v1/leads/public";
const TIMEOUT_MS = 10_000;

export const PUBLIC_PLAYBOOK_URL = "https://cloudless.gr/playbooks/cloud-migration-playbook.pdf";

export type PlaybookDelivery = "email" | "already_sent" | "download" | "none";

export interface PlaybookLeadInput {
  email: string;
  name?: string;
  locale?: string;
  pagePath?: string;
  form?: string;
  consentAt: string;
}

export type ForwardResult =
  | { ok: true; delivery: PlaybookDelivery; playbookUrl: string }
  | {
      ok: false;
      reason: "not_configured" | "access_denied" | "rejected" | "upstream_error";
      status?: number;
    };

interface LeadsTarget {
  url: string;
  creds: CfAccessCreds;
}

export async function resolveLeadsTarget(): Promise<LeadsTarget | null> {
  const cfg = (await getConfig()) as unknown as Record<string, string | undefined>;
  const creds = splitServiceToken(cfg.SOCIALAUTO_SERVICE_TOKEN, cfg.SOCIALAUTO_CF_ACCESS_CLIENT_ID);
  if (!creds) return null;
  const explicit = (cfg.SOCIALAUTO_LEADS_URL || "").trim();
  const base = (cfg.SOCIALAUTO_API_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  return { url: explicit || `${base}${LEADS_PATH}`, creds };
}

const DELIVERIES = new Set<PlaybookDelivery>(["email", "already_sent", "download", "none"]);

/** The lead endpoint never redirects; an Access bounce lands on
 *  *.cloudflareaccess.com or /cdn-cgi/access/* (service token missing/wrong). */
function isAccessRedirect(res: Response): boolean {
  if (res.status < 300 || res.status >= 400) return false;
  const location = res.headers.get("location") ?? "";
  if (!location) return false;
  try {
    const url = new URL(location, "https://social.cloudless.gr");
    const host = url.hostname.toLowerCase();
    if (host === "cloudflareaccess.com" || host.endsWith(".cloudflareaccess.com")) {
      return true;
    }
    return url.pathname.includes("/cdn-cgi/access/");
    /* v8 ignore start -- unreachable: new URL(anyString, validBase) never throws */
  } catch {
    return false;
    /* v8 ignore stop -- lib-socialauto-public-leads */
  }
}

export type LeadFailure = Extract<ForwardResult, { ok: false }>;

type PostResult = { ok: true; status: number; data: Record<string, unknown> } | LeadFailure;

/**
 * Shared transport for every public lead payload: resolves the Access service
 * token, posts with `redirect: "manual"` (an unauthenticated call is bounced
 * to the Access login page, which must never be silently followed into a 200
 * HTML page), times out, and normalises the outcome. Returning
 * `not_configured` rather than calling the Access-protected host
 * unauthenticated is deliberate — a missing token must never look like a
 * captured lead.
 */
async function postPublicLead(
  payload: Record<string, unknown>,
  logTag: string
): Promise<PostResult> {
  const target = await resolveLeadsTarget();
  if (!target) return { ok: false, reason: "not_configured" };

  let res: Response;
  try {
    res = await fetch(target.url, {
      method: "POST",
      // Access answers an unauthenticated call with a 302 to its login page —
      // never follow it; treat it as a configuration problem.
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Cf-Access-Client-Id": target.creds.clientId,
        "Cf-Access-Client-Secret": target.creds.clientSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      `[${logTag}] SocialAuto request failed:`,
      err instanceof Error ? err.name : "UnknownError"
    );
    return { ok: false, reason: "upstream_error" };
  }

  if (isAccessRedirect(res) || res.status === 401 || res.status === 403) {
    return { ok: false, reason: "access_denied", status: res.status };
  }
  if (res.status === 400 || res.status === 422) {
    return { ok: false, reason: "rejected", status: res.status };
  }
  if (!res.ok) {
    return { ok: false, reason: "upstream_error", status: res.status };
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // A 200 HTML page (e.g. an Access interstitial) is not a lead ack.
    return { ok: false, reason: "upstream_error", status: res.status };
  }
  if (!data || data.ok !== true) {
    return { ok: false, reason: "upstream_error", status: res.status };
  }
  return { ok: true, status: res.status, data };
}

export async function forwardPlaybookLead(input: PlaybookLeadInput): Promise<ForwardResult> {
  const result = await postPublicLead(
    {
      email: input.email,
      name: input.name || undefined,
      site: "cloudless.gr",
      form: input.form ?? "playbook",
      page_path: input.pagePath || undefined,
      locale: input.locale || undefined,
      consent: true,
      consent_at: input.consentAt,
    },
    "playbook-lead"
  );
  if (!result.ok) return result;

  const delivery = DELIVERIES.has(result.data.playbook_delivery as PlaybookDelivery)
    ? (result.data.playbook_delivery as PlaybookDelivery)
    : "email";
  return {
    ok: true,
    delivery,
    playbookUrl: (result.data.playbook_url as string | null | undefined) || PUBLIC_PLAYBOOK_URL,
  };
}

/**
 * Free 30-minute tech checkup request (`/[locale]/audit`).
 *
 * The three discovery answers (goal / pain / timeline) required by the
 * Cloudless Agent Manifest's CALENDAR_INTEGRATION_ROUTING travel as the lead
 * message so the audit call starts pre-briefed. `consentAt` is only ever
 * supplied by the route when the visitor actually ticked the consent box.
 */
export interface AuditLeadInput {
  email: string;
  name?: string;
  locale?: string;
  pagePath?: string;
  consentAt: string;
  goal: string;
  pain: string;
  timeline: string;
}

export async function forwardAuditLead(input: AuditLeadInput): Promise<LeadFailure | { ok: true }> {
  const result = await postPublicLead(
    {
      email: input.email,
      name: input.name || input.email.split("@")[0],
      site: "cloudless.gr/audit",
      form: "audit-request",
      interest: "audit",
      page_path: input.pagePath || undefined,
      locale: input.locale || undefined,
      consent: true,
      consent_at: input.consentAt,
      message: `Goal: ${input.goal}\nPain: ${input.pain}\nTimeline: ${input.timeline}`,
    },
    "audit"
  );
  return result.ok ? { ok: true } : result;
}

/**
 * Uptime Kuma — status page + push monitor client.
 *
 * Kuma 2.x architecture note: the REST API (/api/v1/*) is overridden by the
 * Vue SPA catch-all when accessed via the public Cloudflare tunnel OR the
 * NodePort — every path returns text/html. Private management therefore happens
 * via Socket.IO (the Kuma UI) or the push monitor mechanism.
 *
 * What works from this module:
 *   1. Public status-page read (no auth) — for the /admin/cluster panel.
 *   2. Push monitor heartbeat (KUMA_API_KEY in the URL) — app sends "I'm alive"
 *      pings to Kuma so operators see app health without polling from Kuma.
 *   3. Push monitor URL generation — build the correct push URL for any monitor.
 *
 * Config (SSM or env):
 *   KUMA_BASE_URL          base URL, default https://kuma.cloudless.gr
 *   KUMA_STATUS_PAGE_SLUG  status page slug, default "default"
 *   KUMA_API_KEY           uk1_* key from Kuma → Settings → API Keys
 *                          Used in push monitor URLs (not HTTP auth — Kuma's
 *                          SPA intercepts the Authorization header before the
 *                          API router sees it when accessed via the tunnel).
 *
 * Endpoints used (Kuma 2.x — confirmed working):
 *   GET /api/status-page/<slug>            → publicGroupList[].monitorList
 *   GET /api/status-page/heartbeat/<slug>  → per-monitor heartbeats + ping
 *   GET /api/push/<pushToken>?status=up&msg=OK&ping=<ms>  → push heartbeat
 */

import { getConfig } from "@/lib/ssm-config";

export interface KumaMonitor {
  id: number;
  name: string;
  /** "up" | "down" | "pending" — derived from the latest heartbeat status. */
  status: "up" | "down" | "pending";
  /** Last ping in ms. `null` when no heartbeat yet. */
  pingMs: number | null;
  /** ISO timestamp of the most recent heartbeat we have. */
  lastHeartbeatAt: string | null;
  /** Status-page group title — for sectioning the UI grid. */
  groupName: string;
}

export interface KumaSummary {
  baseUrl: string;
  slug: string;
  monitors: KumaMonitor[];
  fetchedAt: string;
}

function getKumaConfig(): { baseUrl: string; slug: string } | null {
  const cfg = (globalThis as { __KUMA_CFG?: { baseUrl: string; slug: string } }).__KUMA_CFG;
  if (cfg) return cfg;
  return null;
}

async function loadKumaConfig(): Promise<{
  baseUrl: string;
  slug: string;
  apiKey?: string;
} | null> {
  const cached = getKumaConfig();
  if (cached) return cached;
  const cfg = await getConfig();
  const baseUrl = (cfg.KUMA_BASE_URL || "https://kuma.cloudless.gr").replace(/\/$/, "");
  const slug = cfg.KUMA_STATUS_PAGE_SLUG || "default";
  const apiKey = cfg.KUMA_API_KEY || undefined;
  if (!baseUrl) return null;
  (globalThis as { __KUMA_CFG?: { baseUrl: string; slug: string; apiKey?: string } }).__KUMA_CFG = {
    baseUrl,
    slug,
    apiKey,
  };
  return { baseUrl, slug, apiKey };
}

/**
 * Build a Kuma push monitor URL for the given push token.
 * The push token is shown in the Kuma UI when you create a "Push" monitor.
 * Call this URL (GET) on a schedule to tell Kuma the service is alive.
 *
 * Example: GET /api/push/abc123?status=up&msg=OK&ping=42
 */
export async function buildPushUrl(
  pushToken: string,
  opts: { status?: "up" | "down"; msg?: string; pingMs?: number } = {}
): Promise<string> {
  const cfg = await loadKumaConfig();
  const base = cfg?.baseUrl ?? "https://kuma.cloudless.gr";
  const params = new URLSearchParams({
    status: opts.status ?? "up",
    msg: opts.msg ?? "OK",
    ...(opts.pingMs !== undefined ? { ping: String(opts.pingMs) } : {}),
  });
  return `${base}/api/push/${encodeURIComponent(pushToken)}?${params.toString()}`;
}

/**
 * Send a heartbeat ping to a Kuma push monitor.
 * Call this from a health-check or cron to keep the monitor green.
 * Returns true on success, false on failure (never throws).
 */
export async function sendPushHeartbeat(
  pushToken: string,
  opts: { status?: "up" | "down"; msg?: string; pingMs?: number; timeoutMs?: number } = {}
): Promise<boolean> {
  try {
    const url = await buildPushUrl(pushToken, opts);
    const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Force a re-read of KUMA_* from SSM (call after the operator creates a
 *  new status page or rotates the host). */
export function resetKumaCache(): void {
  (globalThis as { __KUMA_CFG?: { baseUrl: string; slug: string } }).__KUMA_CFG = undefined;
}

/**
 * Fetch + flatten the Kuma status page into a single `KumaMonitor[]`.
 *
 * Returns `null` on any failure (network error, 404 for a missing slug,
 * Kuma down) — callers render a "configure / unreachable" placeholder.
 * Never throws.
 */
export async function getKumaSummary(timeoutMs = 5000): Promise<KumaSummary | null> {
  const cfg = await loadKumaConfig();
  if (!cfg) return null;

  const { baseUrl, slug } = cfg;
  const fetchedAt = new Date().toISOString();

  try {
    const [pageRes, hbRes] = await Promise.all([
      fetch(`${baseUrl}/api/status-page/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      }),
      fetch(`${baseUrl}/api/status-page/heartbeat/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!pageRes.ok) return null;
    const page = (await pageRes.json()) as KumaStatusPageResponse;
    const hb = hbRes.ok ? ((await hbRes.json()) as KumaHeartbeatResponse) : { heartbeatList: {} };

    const monitors: KumaMonitor[] = [];
    for (const group of page.publicGroupList ?? []) {
      for (const m of group.monitorList ?? []) {
        const list = hb.heartbeatList?.[String(m.id)] ?? [];
        const latest = list[list.length - 1];
        monitors.push({
          id: m.id,
          name: m.name,
          status: kumaStatus(latest?.status),
          pingMs: typeof latest?.ping === "number" ? latest.ping : null,
          lastHeartbeatAt: latest?.time ?? null,
          groupName: group.name ?? "Monitors",
        });
      }
    }

    return { baseUrl, slug, monitors, fetchedAt };
  } catch {
    return null;
  }
}

function kumaStatus(raw: number | undefined): "up" | "down" | "pending" {
  // Kuma `status`: 0=down, 1=up, 2=pending, 3=maintenance.
  if (raw === 1) return "up";
  if (raw === 0) return "down";
  return "pending";
}

interface KumaStatusPageResponse {
  publicGroupList?: Array<{
    name?: string;
    monitorList?: Array<{ id: number; name: string }>;
  }>;
}

interface KumaHeartbeatResponse {
  heartbeatList?: Record<string, Array<{ status: number; time: string; ping?: number }>>;
}

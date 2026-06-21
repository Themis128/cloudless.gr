/**
 * Uptime Kuma — public status page summariser.
 *
 * Used by the `/admin/cluster` page to render a compact monitor grid
 * pulled from Kuma's read-only status-page JSON. The status page itself
 * is public (no auth), so we use it via the public tunnel host
 * `kuma.cloudless.gr` from both Lambda and the cluster pod — no
 * in-cluster Service URL needed.
 *
 * Config (SSM or env):
 *   KUMA_BASE_URL          base URL of the Kuma instance.
 *                          Default https://kuma.cloudless.gr.
 *   KUMA_STATUS_PAGE_SLUG  status page slug (operator-created).
 *                          Default `default`.
 *
 * Both keys are optional — missing config gracefully degrades the panel
 * to a "configure me" placeholder rather than throwing.
 *
 * Endpoints used (Kuma 2.x):
 *   GET /api/status-page/<slug>            → publicGroupList[].monitorList
 *   GET /api/status-page/heartbeat/<slug>  → per-monitor heartbeats + ping
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

async function loadKumaConfig(): Promise<{ baseUrl: string; slug: string } | null> {
  const cached = getKumaConfig();
  if (cached) return cached;
  const cfg = await getConfig();
  const baseUrl = (cfg.KUMA_BASE_URL || "https://kuma.cloudless.gr").replace(/\/$/, "");
  const slug = cfg.KUMA_STATUS_PAGE_SLUG || "default";
  if (!baseUrl) return null;
  (globalThis as { __KUMA_CFG?: { baseUrl: string; slug: string } }).__KUMA_CFG = { baseUrl, slug };
  return { baseUrl, slug };
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

/**
 * Grafana admin API client — dashboard CRUD + health probe. Used by future
 * /admin/grafana page and by any ETL that wants to provision a dashboard
 * programmatically (e.g. when a new self-hosted app comes online).
 *
 * Config (SSM or env):
 *   GRAFANA_BASE_URL  default: https://grafana.cloudless.gr
 *   GRAFANA_API_TOKEN admin-scoped API token from Grafana Settings → API Keys
 *
 * Both halves of the app reuse this lib. Token grants full admin so it's
 * never exposed to the client — every consumer is a server-side route or
 * Lambda. Unconfigured → throws `GrafanaNotConfiguredError`.
 */
import { getConfig } from "@/lib/ssm-config";

export class GrafanaNotConfiguredError extends Error {
  constructor() {
    super("Grafana API not configured (GRAFANA_API_TOKEN missing)");
    this.name = "GrafanaNotConfiguredError";
  }
}

export class GrafanaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Grafana API error ${status}: ${body.slice(0, 200)}`);
    this.name = "GrafanaApiError";
  }
}

async function getGrafanaConfig(): Promise<{ baseUrl: string; token: string }> {
  const cfg = await getConfig();
  const baseUrl = (cfg.GRAFANA_BASE_URL || "https://grafana.cloudless.gr").replace(/\/$/, "");
  const token = cfg.GRAFANA_API_TOKEN;
  if (!token) throw new GrafanaNotConfiguredError();
  return { baseUrl, token };
}

async function grafanaFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { baseUrl, token } = await getGrafanaConfig();
  const { timeoutMs, headers, ...rest } = init;
  return fetch(`${baseUrl}/api${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs ?? 10_000),
  });
}

export async function isGrafanaConfigured(): Promise<boolean> {
  try {
    await getGrafanaConfig();
    return true;
  } catch {
    return false;
  }
}

export async function pingGrafana(): Promise<boolean> {
  try {
    const { baseUrl } = await getGrafanaConfig();
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface GrafanaDashboardSummary {
  uid: string;
  title: string;
  url: string;
  type: "dash-db" | "dash-folder";
  tags: string[];
  folderTitle?: string;
}

export async function listDashboards(query = ""): Promise<GrafanaDashboardSummary[]> {
  const qs = new URLSearchParams({ type: "dash-db", limit: "200" });
  if (query) qs.set("query", query);
  const res = await grafanaFetch(`/search?${qs.toString()}`);
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as any as GrafanaDashboardSummary[];
}

export interface GrafanaDashboardResponse {
  dashboard: Record<string, unknown>;
  meta: {
    url: string;
    folderTitle?: string;
    updated: string;
  };
}

export async function getDashboard(uid: string): Promise<GrafanaDashboardResponse> {
  const res = await grafanaFetch(`/dashboards/uid/${encodeURIComponent(uid)}`);
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as any as GrafanaDashboardResponse;
}

/**
 * Create or update a dashboard. When `dashboard.uid` is present the existing
 * dashboard is updated; otherwise a new one is created. Pass `overwrite: true`
 * to force-update if Grafana would otherwise reject due to version conflict.
 */
export async function upsertDashboard(
  dashboard: Record<string, unknown>,
  options: { folderUid?: string; overwrite?: boolean; message?: string } = {}
): Promise<{ uid: string; url: string; version: number }> {
  const body = {
    dashboard,
    folderUid: options.folderUid,
    overwrite: options.overwrite ?? true,
    message: options.message ?? "Updated via /api/admin/grafana",
  };
  const res = await grafanaFetch("/dashboards/db", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as any as { uid: string; url: string; version: number };
  return data;
}

// ---------------------------------------------------------------------------
// Datasource management (Prometheus sync)
// ---------------------------------------------------------------------------

export interface GrafanaDatasource {
  id: number;
  uid: string;
  name: string;
  type: string;
  url: string;
  access: "proxy" | "direct";
  isDefault: boolean;
}

export async function listDatasources(): Promise<GrafanaDatasource[]> {
  const res = await grafanaFetch("/datasources");
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as any as GrafanaDatasource[];
}

export async function getDatasourceByName(name: string): Promise<GrafanaDatasource | null> {
  const sources = await listDatasources();
  return sources.find((s) => s.name === name) ?? null;
}

/**
 * Ensure a Prometheus datasource named `name` pointing at `prometheusUrl`
 * exists and is the default datasource. Creates if missing, updates URL if changed.
 */
export async function syncPrometheusDatasource(
  prometheusUrl: string,
  name = "Prometheus"
): Promise<GrafanaDatasource> {
  const existing = await getDatasourceByName(name);

  const payload = {
    name,
    type: "prometheus",
    url: prometheusUrl,
    access: "proxy",
    isDefault: true,
    jsonData: { httpMethod: "POST", timeInterval: "15s" },
  };

  if (existing) {
    if (existing.url === prometheusUrl) return existing;
    const res = await grafanaFetch(`/datasources/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, id: existing.id, uid: existing.uid }),
    });
    if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
    return (await res.json()) as any as GrafanaDatasource;
  }

  const res = await grafanaFetch("/datasources", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  const created = (await res.json()) as any as { datasource: GrafanaDatasource };
  return created.datasource;
}

// ---------------------------------------------------------------------------
// Prometheus instant query (via Grafana datasource proxy)
// ---------------------------------------------------------------------------

export interface PrometheusQueryResult {
  metric: Record<string, string>;
  value: [number, string];
}

/**
 * Run a PromQL instant query via the Grafana datasource proxy.
 * The datasource UID is resolved automatically from the "Prometheus" datasource.
 */
export async function prometheusQuery(query: string): Promise<PrometheusQueryResult[]> {
  const ds = await getDatasourceByName("Prometheus");
  if (!ds) throw new Error('No "Prometheus" datasource configured in Grafana');
  const qs = new URLSearchParams({ query, time: String(Math.floor(Date.now() / 1000)) });
  const res = await grafanaFetch(
    `/datasources/proxy/uid/${encodeURIComponent(ds.uid)}/api/v1/query?${qs.toString()}`
  );
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  const body = (await res.json()) as any as {
    status: string;
    data: { resultType: string; result: PrometheusQueryResult[] };
  };
  if (body.status !== "success") throw new Error(`Prometheus query failed: ${body.status}`);
  return body.data.result;
}

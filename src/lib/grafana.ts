/** * Grafana admin API client — dashboard CRUD + health probe. Used by future * /admin/grafana page and by any ETL that wants to provision a dashboard * programmatically (e.g. when a new self-hosted app comes online). * * Config (SSM or env): * GRAFANA_BASE_URL default: https://grafana.cloudless.gr * GRAFANA_API_TOKEN admin-scoped API token from Grafana Settings → API Keys * * Both halves of the app reuse this lib. Token grants full admin so it's * never exposed to the client — every consumer is a server-side route or * Lambda. Unconfigured → throws `GrafanaNotConfiguredError`. */ import { getConfig } from "@/lib/ssm-config";

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

export interface GrafanaDatasource {
  uid: string;
  name: string;
  type: string;
  url: string;
  basicAuth: boolean;
  basicAuthUser?: string;
  isDefault: boolean;
}

export interface GrafanaDashboardSummary {
  uid: string;
  title: string;
  url: string;
  type: "dash-db" | "dash-folder";
  tags: string[];
  folderTitle?: string;
}

export async function listDatasources(): Promise<GrafanaDatasource[]> {
  const res = await grafanaFetch("/datasources");
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as GrafanaDatasource[];
}

export async function syncPrometheusDatasource(prometheusUrl?: string): Promise<GrafanaDatasource> {
  const body = prometheusUrl ? { url: prometheusUrl } : undefined;
  const res = await grafanaFetch(
    "/datasources/uid/prometheus/sync",
    { method: "POST", body: body ? JSON.stringify(body) : undefined }
  );
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as GrafanaDatasource;
}

export async function prometheusQuery(query: string): Promise<unknown> {
  const res = await grafanaFetch(`/datasources/uid/prometheus/query?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return res.json();
}

export async function listDashboards(query = ""): Promise<GrafanaDashboardSummary[]> {
  const qs = new URLSearchParams({ type: "dash-db", limit: "200" });
  if (query) qs.set("query", query);
  const res = await grafanaFetch(`/search?${qs.toString()}`);
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as GrafanaDashboardSummary[];
}

export interface GrafanaDashboardResponse {
  dashboard: Record<string, unknown>;
  meta: { url: string; folderTitle?: string; updated: string };
}

export async function getDashboard(uid: string): Promise<GrafanaDashboardResponse> {
  const res = await grafanaFetch(`/dashboards/uid/${encodeURIComponent(uid)}`);
  if (!res.ok) throw new GrafanaApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as GrafanaDashboardResponse;
}

/** * Create or update a dashboard. When `dashboard.uid` is present the existing * dashboard is updated; otherwise a new one is created. Pass `overwrite: true` * to force-update if Grafana would otherwise reject due to version conflict. */
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
  const data = (await res.json()) as { uid: string; url: string; version: number };
  return data;
}
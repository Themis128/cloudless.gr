/**
 * Minimal in-cluster Kubernetes API client.
 *
 * Lets the cloudless app pod read its own cluster's state — currently used by
 * `/api/admin/cluster/watchdogs` to surface the live status of the monitoring
 * CronJobs (cluster-alerts, omv-disk-watchdog, omv-backup-verify, postiz-slack-notify)
 * in the admin UI.
 *
 * Reads the in-pod service-account token + CA cert from the standard projected
 * volume at /var/run/secrets/kubernetes.io/serviceaccount. Talks to the in-cluster
 * API server at https://kubernetes.default.svc. No external k8s client library
 * needed — we only use it for read-only `GET` on a tiny surface (cronjobs + jobs
 * in monitoring namespace).
 *
 * RBAC: `infrastructure/monitoring/watchdog-reader-rbac.yaml` grants the
 * cloudless/default SA `get`/`list` on cronjobs+jobs in `monitoring`.
 *
 * Outside-of-cluster (local dev, tests): `isInCluster()` returns false and
 * every fetcher returns `null` so the admin page renders a "not in cluster"
 * empty state instead of crashing.
 */
import { readFileSync, existsSync } from "node:fs";
import { Agent, fetch as undiciFetch, type RequestInit } from "undici";

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";
const TOKEN_PATH = `${SA_DIR}/token`;
const CA_PATH = `${SA_DIR}/ca.crt`;
const NAMESPACE_PATH = `${SA_DIR}/namespace`;
const API_BASE = "https://kubernetes.default.svc";

let cachedAgent: Agent | null = null;
let cachedToken: string | null = null;
let cachedTokenReadAt = 0;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export function isInCluster(): boolean {
  return existsSync(TOKEN_PATH);
}

export function getCurrentNamespace(): string | null {
  if (!isInCluster()) return null;
  try {
    return readFileSync(NAMESPACE_PATH, "utf8").trim();
  } catch {
    return null;
  }
}

function getToken(): string {
  const now = Date.now();
  if (cachedToken && now - cachedTokenReadAt < TOKEN_TTL_MS) return cachedToken;
  cachedToken = readFileSync(TOKEN_PATH, "utf8").trim();
  cachedTokenReadAt = now;
  return cachedToken;
}

function getAgent(): Agent {
  if (cachedAgent) return cachedAgent;
  const ca = readFileSync(CA_PATH);
  cachedAgent = new Agent({ connect: { ca } });
  return cachedAgent;
}

/**
 * Authenticated GET against the in-cluster API server. Returns the parsed JSON
 * body on success, or `null` on any non-2xx / network error so callers can
 * degrade gracefully (the admin UI shows a quiet empty state).
 */
async function k8sGet<T = unknown>(path: string): Promise<T | null> {
  if (!isInCluster()) return null;
  try {
    const init: RequestInit = {
      method: "GET",
      headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" },
      dispatcher: getAgent(),
      signal: AbortSignal.timeout(5000),
    };
    const res = await undiciFetch(`${API_BASE}${path}`, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Domain types — minimal projection of what /admin/cluster surfaces
// ---------------------------------------------------------------------------

export interface CronJobSummary {
  /** Display name. */
  name: string;
  namespace: string;
  /** Cron expression as in CronJob.spec.schedule. */
  schedule: string;
  /** True when CronJob.spec.suspend === true. */
  suspended: boolean;
  /** Most-recent scheduled job ISO timestamp, if any. */
  lastScheduleTime: string | null;
  /** Most-recent SUCCESSFUL completion ISO timestamp, if any. */
  lastSuccessfulTime: string | null;
  /** True when the most recent job (if any) failed. */
  lastRunFailed: boolean | null;
}

interface RawCronJob {
  metadata?: { name?: string; namespace?: string };
  spec?: { schedule?: string; suspend?: boolean };
  status?: {
    lastScheduleTime?: string;
    lastSuccessfulTime?: string;
  };
}

interface RawJob {
  metadata?: {
    name?: string;
    ownerReferences?: { kind?: string; name?: string }[];
    creationTimestamp?: string;
  };
  status?: {
    succeeded?: number;
    failed?: number;
    completionTime?: string;
  };
}

/**
 * List monitoring-namespace CronJobs by name, returning a compact summary.
 * Also peeks at the most-recent Job per CronJob to detect "last run failed"
 * which the CronJob status itself doesn't expose directly.
 */
export async function listWatchdogCronJobs(names: string[]): Promise<CronJobSummary[]> {
  const ns = "monitoring";
  const [cronList, jobList] = await Promise.all([
    k8sGet<{ items?: RawCronJob[] }>(`/apis/batch/v1/namespaces/${ns}/cronjobs`),
    k8sGet<{ items?: RawJob[] }>(`/apis/batch/v1/namespaces/${ns}/jobs`),
  ]);
  if (!cronList?.items) return [];

  // Index latest-by-owner CronJob name from the Jobs list.
  const latestByOwner = new Map<string, RawJob>();
  for (const job of jobList?.items ?? []) {
    const owner = job.metadata?.ownerReferences?.find((o) => o.kind === "CronJob")?.name;
    if (!owner) continue;
    const prev = latestByOwner.get(owner);
    const a = job.metadata?.creationTimestamp ?? "";
    const b = prev?.metadata?.creationTimestamp ?? "";
    if (!prev || a > b) latestByOwner.set(owner, job);
  }

  const wanted = new Set(names);
  const out: CronJobSummary[] = [];
  for (const cj of cronList.items) {
    const name = cj.metadata?.name ?? "";
    if (!wanted.has(name)) continue;
    const latest = latestByOwner.get(name);
    const lastRunFailed = latest
      ? (latest.status?.failed ?? 0) > 0 && (latest.status?.succeeded ?? 0) === 0
      : null;
    out.push({
      name,
      namespace: cj.metadata?.namespace ?? ns,
      schedule: cj.spec?.schedule ?? "?",
      suspended: cj.spec?.suspend === true,
      lastScheduleTime: cj.status?.lastScheduleTime ?? null,
      lastSuccessfulTime: cj.status?.lastSuccessfulTime ?? null,
      lastRunFailed,
    });
  }
  // Sort in the requested order so the UI is stable.
  out.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  return out;
}

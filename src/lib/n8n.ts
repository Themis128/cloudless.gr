/**
 * n8n public API client — read-side for /admin/integrations and the
 * n8n-to-lake ETL. Auth is `X-N8N-API-KEY` header; key is generated in n8n
 * Settings → API and stored at SSM `/cloudless/production/N8N_API_KEY`.
 *
 * Endpoints exposed by n8n's public REST API (≥ 1.20):
 *   GET  /api/v1/workflows
 *   GET  /api/v1/executions
 *   GET  /api/v1/users         (Enterprise; falls back to single-user mode)
 *
 * Config (SSM or env):
 *   N8N_API_URL       base URL, e.g. https://n8n.cloudless.gr
 *   N8N_API_KEY       JWT-style key starting with n8n_api_
 *
 * Both unconfigured → `N8nNotConfiguredError`.
 */
import { getConfig } from "@/lib/ssm-config";

export class N8nNotConfiguredError extends Error {
  constructor() {
    super("n8n API not configured (N8N_API_URL or N8N_API_KEY missing)");
    this.name = "N8nNotConfiguredError";
  }
}

export class N8nApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`n8n API error ${status}: ${body.slice(0, 200)}`);
    this.name = "N8nApiError";
  }
}

async function getN8nConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const cfg = await getConfig();
  if (!cfg.N8N_API_URL || !cfg.N8N_API_KEY) throw new N8nNotConfiguredError();
  return {
    baseUrl: cfg.N8N_API_URL.replace(/\/$/, ""),
    apiKey: cfg.N8N_API_KEY,
  };
}

async function n8nFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { baseUrl, apiKey } = await getN8nConfig();
  const { timeoutMs, headers, ...rest } = init;
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "X-N8N-API-KEY": apiKey,
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs ?? 10_000),
  });
}

async function callThrowing<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const r = await n8nFetch(path, init);
  if (!r.ok) throw new N8nApiError(r.status, await r.text().catch(() => ""));
  return (await r.json()) as any as T;
}

export async function isN8nConfigured(): Promise<boolean> {
  try {
    await getN8nConfig();
    return true;
  } catch {
    return false;
  }
}

export async function pingN8nHealth(): Promise<boolean> {
  try {
    const cfg = await getN8nConfig();
    const r = await fetch(`${cfg.baseUrl}/healthz`, {
      signal: AbortSignal.timeout(5_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: { id: string; name: string }[];
}

export async function listWorkflows(activeOnly = false): Promise<N8nWorkflow[]> {
  try {
    const r = await callThrowing<{ data: N8nWorkflow[] }>(
      `/workflows?active=${activeOnly ? "true" : "false"}&limit=250`
    );
    return r.data ?? [];
  } catch (e) {
    if (e instanceof N8nNotConfiguredError) return [];
    throw e;
  }
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  status: "success" | "error" | "running" | "waiting" | "canceled";
}

export async function listRecentExecutions(limit = 100): Promise<N8nExecution[]> {
  const capped = Math.max(1, Math.min(limit, 250));
  try {
    const r = await callThrowing<{ data: N8nExecution[] }>(
      `/executions?limit=${capped}&includeData=false`
    );
    return r.data ?? [];
  } catch (e) {
    if (e instanceof N8nNotConfiguredError) return [];
    throw e;
  }
}

/**
 * Trigger a workflow by ID via its webhook URL.
 *
 * Two paths the operator's n8n setup typically exposes:
 *   1. Webhook node attached to the workflow → URL is
 *      `<base>/webhook/<workflow-or-node-path>`. We try this first as it
 *      mirrors the documented public webhook pattern.
 *   2. Public-API execute → `<base>/api/v1/workflows/<id>/execute`. Requires
 *      the workflow to be active. Used as fallback when the webhook URL
 *      isn't reachable.
 *
 * The webhook flow is the more reliable pattern (active + inactive workflows
 * work, no auth complication), so we attempt it first then fall back.
 */
export async function triggerWorkflowByWebhookPath(
  workflowOrWebhookPath: string,
  payload: unknown
): Promise<{ webhook?: unknown; execution?: unknown }> {
  const cfg = await getN8nConfig();

  // Path 1 — webhook URL. n8n exposes both `/webhook/<id>` (production) and
  // `/webhook-test/<id>` (during workflow design); production is the safe
  // default for the trigger receiver.
  const webhookUrl = `${cfg.baseUrl}/webhook/${encodeURIComponent(workflowOrWebhookPath)}`;
  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) return { webhook: (await r.json().catch(() => ({}))) as any };
    // 404 here means the workflow doesn't have a Webhook node at this path;
    // fall through to Path 2 instead of treating as failure.
    if (r.status !== 404) {
      throw new N8nApiError(r.status, await r.text().catch(() => ""));
    }
  } catch (err) {
    // Network / timeout — let Path 2 try (so a broker hiccup doesn't break
    // the whole flow if execute happens to work).
    if (err instanceof N8nApiError) throw err;
  }

  // Path 2 — public-API execute. Requires the workflow to be `active: true`.
  const exec = await callThrowing<{ data: unknown }>(
    `/workflows/${encodeURIComponent(workflowOrWebhookPath)}/execute`,
    { method: "POST", body: JSON.stringify({ workflowData: payload }) }
  );
  return { execution: exec };
}

export async function getN8nSummary(): Promise<{
  configured: boolean;
  healthy: boolean;
  workflowCount: number;
  activeWorkflowCount: number;
  recentExecutionCount: number;
  recentFailureCount: number;
}> {
  const configured = await isN8nConfigured();
  if (!configured) {
    return {
      configured: false,
      healthy: false,
      workflowCount: 0,
      activeWorkflowCount: 0,
      recentExecutionCount: 0,
      recentFailureCount: 0,
    };
  }
  const [healthy, all, execs] = await Promise.all([
    pingN8nHealth(),
    listWorkflows(false).catch(() => [] as N8nWorkflow[]),
    listRecentExecutions(100).catch(() => [] as N8nExecution[]),
  ]);
  return {
    configured: true,
    healthy,
    workflowCount: all.length,
    activeWorkflowCount: all.filter((w) => w.active).length,
    recentExecutionCount: execs.length,
    recentFailureCount: execs.filter((e) => e.status === "error").length,
  };
}

/**
 * AppFlowy Cloud HTTP client — read-side surface for /admin/integrations and
 * the appflowy-to-lake ETL. AppFlowy Cloud's REST API is documented at
 * https://github.com/AppFlowy-IO/AppFlowy-Cloud — authentication is the same
 * GoTrue JWT the SPA uses.
 *
 * Two auth modes:
 *
 * 1. **Service-role JWT** — sign with `GOTRUE_JWT_SECRET` (HS256, role=
 *    "supabase_admin"). Bypasses per-user RLS; safe for read-only admin
 *    queries. Use this for /admin/integrations and ETL.
 * 2. **User JWT** — pass-through of the SPA's access_token. Use when calling
 *    on behalf of a logged-in user (no current consumer).
 *
 * Config (SSM or env):
 *   APPFLOWY_API_URL          base URL, e.g. https://appflowy.cloudless.gr
 *   APPFLOWY_JWT_SECRET       same value as cluster Secret appflowy-secrets/GOTRUE_JWT_SECRET
 *
 * Both unconfigured → typed `AppFlowyNotConfiguredError` so callers can fall
 * back to "not wired yet" without crashing.
 */
import { createHmac } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";

export class AppFlowyNotConfiguredError extends Error {
  constructor() {
    super("AppFlowy API not configured (APPFLOWY_API_URL or APPFLOWY_JWT_SECRET missing)");
    this.name = "AppFlowyNotConfiguredError";
  }
}

export class AppFlowyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`AppFlowy API error ${status}: ${body.slice(0, 200)}`);
    this.name = "AppFlowyApiError";
  }
}

interface AppFlowyConfig {
  baseUrl: string;
  jwtSecret: string;
}

async function getAppFlowyConfig(): Promise<AppFlowyConfig> {
  const cfg = await getConfig();
  if (!cfg.APPFLOWY_API_URL || !cfg.APPFLOWY_JWT_SECRET) {
    throw new AppFlowyNotConfiguredError();
  }
  return {
    baseUrl: cfg.APPFLOWY_API_URL.replace(/\/$/, ""),
    jwtSecret: cfg.APPFLOWY_JWT_SECRET,
  };
}

// Base64url without external deps
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Mint a short-lived service-role JWT. Mirrors the shape GoTrue issues for
 * admin grants: `role: "supabase_admin"`, audience empty, 5-minute expiry.
 */
function signServiceJwt(secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "",
    role: "supabase_admin",
    iss: "cloudless-appflowy-client",
    iat: now,
    exp: now + 300,
  };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

async function appflowyFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { baseUrl, jwtSecret } = await getAppFlowyConfig();
  const { timeoutMs, headers, ...rest } = init;
  return fetch(`${baseUrl}/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signServiceJwt(jwtSecret)}`,
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs ?? 10_000),
  });
}

async function callThrowing<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const res = await appflowyFetch(path, init);
  if (!res.ok) throw new AppFlowyApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Read surface used by /admin/integrations + ETL
// ---------------------------------------------------------------------------

export async function isAppFlowyConfigured(): Promise<boolean> {
  try {
    await getAppFlowyConfig();
    return true;
  } catch {
    return false;
  }
}

/** GET /api/health — public, no auth. Returns true if AC pod is responsive. */
export async function pingAppFlowyHealth(): Promise<boolean> {
  try {
    const cfg = await getAppFlowyConfig();
    const r = await fetch(`${cfg.baseUrl}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface AppFlowyWorkspace {
  workspace_id: string;
  workspace_name: string;
  owner_uid: number;
  member_count: number;
  created_at: string;
}

/**
 * Lists every workspace visible to the service-role JWT. Used by ETL +
 * the admin page tile. Returns empty array on unconfigured.
 */
export async function listAllWorkspaces(): Promise<AppFlowyWorkspace[]> {
  try {
    const r = await callThrowing<{ data: AppFlowyWorkspace[] }>("/admin/workspace");
    return r.data ?? [];
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    throw e;
  }
}

export interface AppFlowyUserSummary {
  uid: number;
  uuid: string;
  email: string;
  name: string;
  created_at: string;
}

export async function listAllUsers(): Promise<AppFlowyUserSummary[]> {
  try {
    const r = await callThrowing<{ data: AppFlowyUserSummary[] }>("/admin/user");
    return r.data ?? [];
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Workspace documents / pages (AppFlowy Cloud REST API)
// ---------------------------------------------------------------------------

export type AppFlowyViewLayout = "Document" | "Grid" | "Board" | "Calendar" | "Chat";

export interface AppFlowyView {
  view_id: string;
  parent_view_id: string;
  name: string;
  layout: AppFlowyViewLayout;
  created_at: string;
  last_edited_time: string;
  is_favorite?: boolean;
  extra?: Record<string, unknown>;
}

export interface AppFlowyDocument {
  view: AppFlowyView;
  data?: Record<string, unknown>;
}

/** List the top-level views (pages) of a workspace. */
export async function listWorkspaceViews(workspaceId: string): Promise<AppFlowyView[]> {
  const r = await callThrowing<{ data: AppFlowyView[] }>(
    `/workspace/${encodeURIComponent(workspaceId)}/folder?depth=2`
  );
  return r.data ?? [];
}

/** Read a single document (page) by view ID. */
export async function getDocument(workspaceId: string, viewId: string): Promise<AppFlowyDocument> {
  return callThrowing<AppFlowyDocument>(
    `/workspace/${encodeURIComponent(workspaceId)}/doc/${encodeURIComponent(viewId)}`
  );
}

/** Create a new Document page under a parent view. Returns the new view. */
export async function createPage(
  workspaceId: string,
  parentViewId: string,
  name: string
): Promise<AppFlowyView> {
  const r = await callThrowing<{ data: AppFlowyView }>(
    `/workspace/${encodeURIComponent(workspaceId)}/page-view`,
    {
      method: "POST",
      body: JSON.stringify({ name, parent_view_id: parentViewId, layout: 0 }),
    }
  );
  return r.data;
}

/** Search across all documents in a workspace. */
export async function searchDocuments(
  workspaceId: string,
  query: string,
  limit = 20
): Promise<AppFlowyView[]> {
  const qs = new URLSearchParams({ query, limit: String(limit) });
  const r = await callThrowing<{ data: AppFlowyView[] }>(
    `/workspace/${encodeURIComponent(workspaceId)}/search?${qs.toString()}`
  );
  return r.data ?? [];
}

/** Lightweight summary for the admin dashboard tile. */
export async function getAppFlowySummary(): Promise<{
  configured: boolean;
  healthy: boolean;
  workspaceCount: number;
  userCount: number;
}> {
  const configured = await isAppFlowyConfigured();
  if (!configured) return { configured: false, healthy: false, workspaceCount: 0, userCount: 0 };
  const [healthy, workspaces, users] = await Promise.all([
    pingAppFlowyHealth(),
    listAllWorkspaces().catch(() => [] as AppFlowyWorkspace[]),
    listAllUsers().catch(() => [] as AppFlowyUserSummary[]),
  ]);
  return {
    configured: true,
    healthy,
    workspaceCount: workspaces.length,
    userCount: users.length,
  };
}

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
  return (await res.json()) as any as T;
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

// ---------------------------------------------------------------------------
// CMS helpers — page rename + document content update
// ---------------------------------------------------------------------------

/** Rename a page/view. */
export async function renameView(workspaceId: string, viewId: string, name: string): Promise<void> {
  await callThrowing(`/workspace/${encodeURIComponent(workspaceId)}/page-view`, {
    method: "PATCH",
    body: JSON.stringify({ view_id: viewId, name }),
  });
}

/**
 * Replace the markdown body of a document page.
 */
export async function updateDocumentContent(
  workspaceId: string,
  viewId: string,
  markdown: string
): Promise<void> {
  await callThrowing(
    `/workspace/${encodeURIComponent(workspaceId)}/doc/${encodeURIComponent(viewId)}`,
    {
      method: "POST",
      body: JSON.stringify({ data: markdown }),
    }
  );
}

/**
 * Deep-recursive workspace view listing.
 */
export async function listAllViewsDeep(workspaceId: string, depth = 5): Promise<AppFlowyView[]> {
  const r = await callThrowing<{ data: Record<string, unknown> }>(
    `/workspace/${encodeURIComponent(workspaceId)}/folder?depth=${depth}`
  );

  if ((r as { code?: number }).code && (r as { code?: number }).code !== 0) {
    return [];
  }

  const root = (r as { data?: Record<string, unknown> }).data;
  if (!root) return [];

  const views: AppFlowyView[] = [];
  function walk(node: Record<string, unknown>): void {
    if (node.view_id && node.name) {
      views.push(node as unknown as AppFlowyView);
    }
    const children = (node.children as { views?: Array<Record<string, unknown>> } | undefined)
      ?.views;
    if (children) {
      for (const child of children) walk(child);
    }
  }
  walk(root);
  return views;
}

/**
 * Extract plain-text / markdown from a document response.
 */
export function extractDocText(doc: AppFlowyDocument): string {
  const d = doc.data as Record<string, unknown> | undefined;
  if (!d) return "";
  return (
    (typeof d.text === "string" && d.text) ||
    (typeof d.markdown === "string" && d.markdown) ||
    (typeof d.content === "string" && d.content) ||
    (typeof d === "string" && d) ||
    ""
  );
}

/**
 * Simple frontmatter parser for AppFlowy document bodies.
 */
export function parseAppFlowyFrontmatter(text: string): {
  meta: Record<string, string | boolean | string[]>;
  body: string;
} {
  const meta: Record<string, string | boolean | string[]> = {};
  const trimmed = text.trim();

  if (!trimmed.startsWith("---")) {
    return { meta, body: trimmed };
  }

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) {
    return { meta, body: trimmed };
  }

  const front = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();

  for (const line of front.split("\n")) {
    const eq = line.indexOf(":");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const raw = line.slice(eq + 1).trim();
    const value: string | boolean | string[] =
      raw === "true"
        ? true
        : raw === "false"
          ? false
          : raw.startsWith("[") && raw.endsWith("]")
            ? raw
                .slice(1, -1)
                .split(",")
                .map((v) => v.trim().replace(/^["']|["']$/g, ""))
                .filter(Boolean)
            : raw.replace(/^["']|["']$/g, "");

    meta[key] = value as string | boolean | string[];
  }

  return { meta, body };
}

/**
 * Very small markdown-to-HTML converter.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let blockquote = false;

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };
  const closeBq = () => {
    if (blockquote) {
      html.push("</blockquote>");
      blockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith("```")) {
      closeLists();
      closeBq();
      const lang = line.slice(3).trim();
      html.push(`<pre><code class="language-${lang}">`);
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        html.push(escapeHtml(lines[i]));
        i++;
      }
      html.push("</code></pre>");
      continue;
    }

    if (line.startsWith("> ")) {
      closeLists();
      if (!blockquote) {
        html.push("<blockquote>");
        blockquote = true;
      }
      html.push(`<p>${inlineMd(line.slice(2))}</p>`);
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      closeLists();
      closeBq();
      const m = line.match(/^(#{1,3})\s+(.*)$/);
      if (m) html.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`);
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      closeBq();
      if (!inUl) {
        closeLists();
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${inlineMd(line.replace(/^[-*]\s/, ""))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      closeBq();
      if (!inOl) {
        closeLists();
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${inlineMd(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }

    if (line === "---" || line === "***") {
      closeLists();
      closeBq();
      html.push("<hr />");
      continue;
    }

    closeLists();
    closeBq();
    if (line.length > 0) {
      html.push(`<p>${inlineMd(line)}</p>`);
    }
  }

  closeLists();
  closeBq();
  return html.join("\n");
}

function inlineMd(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * AppFlowy Cloud HTTP client — read-side surface for CMS dual-run,
 * /admin/integrations, and the appflowy-to-lake ETL.
 *
 * Auth modes (tried in order for CMS reads):
 *
 * 1. **User JWT** — GoTrue password grant with APPFLOWY_EMAIL /
 *    APPFLOWY_PASSWORD. Uses `/api/workspace` + `/folder` + `/page-view`
 *    (the surface that works on our self-hosted build).
 * 2. **Service-role JWT** — HS256 with GOTRUE_JWT_SECRET (`role:
 *    supabase_admin`). Targets `/api/admin/*` when that admin surface is
 *    enabled (not available on all AppFlowy Cloud builds).
 *
 * Config (SSM or env):
 * APPFLOWY_API_URL base URL, e.g. https://appflowy.cloudless.gr
 * APPFLOWY_EMAIL + APPFLOWY_PASSWORD for user-JWT reads (preferred)
 * APPFLOWY_JWT_SECRET same value as cluster Secret GOTRUE_JWT_SECRET
 *
 * Both unconfigured → typed `AppFlowyNotConfiguredError` so callers can fall
 * back to "not wired yet" without crashing.
 */
import { createHmac } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";

export class AppFlowyNotConfiguredError extends Error {
  constructor() {
    super(
      "AppFlowy API not configured (APPFLOWY_API_URL plus user credentials or JWT secret missing)"
    );
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
  email: string;
  password: string;
}

let cachedUserToken: { token: string; expiresAtMs: number } | null = null;
const VIEWS_TTL_MS = 60_000;
const WORKSPACES_TTL_MS = 60_000;
let cachedWorkspaces: { value: AppFlowyWorkspace[]; expiresAtMs: number } | null = null;
const cachedViewsByWorkspace = new Map<string, { value: AppFlowyView[]; expiresAtMs: number }>();

async function getAppFlowyConfig(): Promise<AppFlowyConfig> {
  const cfg = await getConfig();
  const baseUrl = (cfg.APPFLOWY_API_URL ?? "").replace(/\/$/, "");
  const jwtSecret = cfg.APPFLOWY_JWT_SECRET ?? "";
  const email = cfg.APPFLOWY_EMAIL ?? "";
  const password = cfg.APPFLOWY_PASSWORD ?? "";
  if (!baseUrl || (!jwtSecret && !(email && password))) {
    throw new AppFlowyNotConfiguredError();
  }
  return { baseUrl, jwtSecret, email, password };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

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

async function getUserAccessToken(cfg: AppFlowyConfig): Promise<string | null> {
  if (!cfg.email || !cfg.password) return null;
  const now = Date.now();
  if (cachedUserToken && cachedUserToken.expiresAtMs > now + 30_000) {
    return cachedUserToken.token;
  }

  const res = await fetch(`${cfg.baseUrl}/gotrue/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "password", email: cfg.email, password: cfg.password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new AppFlowyApiError(res.status, await res.text().catch(() => ""));
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new AppFlowyApiError(res.status, "GoTrue response missing access_token");
  }
  const expiresInSec = typeof body.expires_in === "number" ? body.expires_in : 3600;
  cachedUserToken = {
    token: body.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return body.access_token;
}

async function resolveBearerToken(cfg: AppFlowyConfig): Promise<string> {
  const userToken = await getUserAccessToken(cfg);
  if (userToken) return userToken;
  if (cfg.jwtSecret) return signServiceJwt(cfg.jwtSecret);
  throw new AppFlowyNotConfiguredError();
}

async function appflowyFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const cfg = await getAppFlowyConfig();
  const { timeoutMs, headers, ...rest } = init;
  const token = await resolveBearerToken(cfg);
  return fetch(`${cfg.baseUrl}/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs ?? 15_000),
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

export interface AppFlowyUserSummary {
  uid: number;
  uuid: string;
  email: string;
  name: string;
  created_at: string;
}

export async function listAllWorkspaces(): Promise<AppFlowyWorkspace[]> {
  const now = Date.now();
  if (cachedWorkspaces && cachedWorkspaces.expiresAtMs > now) {
    return cachedWorkspaces.value;
  }

  try {
    // User API (works on self-hosted cloudless build)
    const r = await callThrowing<{ data: AppFlowyWorkspace[] }>("/workspace");
    if (r.data?.length) {
      cachedWorkspaces = { value: r.data, expiresAtMs: now + WORKSPACES_TTL_MS };
      return r.data;
    }
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    // Fall through to admin surface when user path fails.
  }

  try {
    const r = await callThrowing<{ data: AppFlowyWorkspace[] }>("/admin/workspace");
    const value = r.data ?? [];
    cachedWorkspaces = { value, expiresAtMs: now + WORKSPACES_TTL_MS };
    return value;
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    throw e;
  }
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

export interface AppFlowyView {
  view_id: string;
  name: string;
  type: "document" | "folder";
  document_id?: string;
  last_edited_time: string;
  cover_image?: string;
}

type FolderNode = {
  view_id?: string;
  name?: string;
  layout?: number;
  last_edited_time?: string;
  has_children?: boolean;
  children?: FolderNode[];
  view?: FolderNode;
};

function flattenFolderViews(node: unknown, out: AppFlowyView[] = []): AppFlowyView[] {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const child of node) flattenFolderViews(child, out);
    return out;
  }
  if (typeof node !== "object") return out;

  const n = node as FolderNode;
  const view = n.view ?? n;
  const viewId = view.view_id;
  const name = view.name;
  if (viewId && name) {
    const isFolder = Boolean(view.has_children) || view.layout === 1;
    out.push({
      view_id: viewId,
      name,
      type: isFolder ? "folder" : "document",
      last_edited_time: view.last_edited_time ?? "",
    });
  }
  if (Array.isArray(view.children)) {
    flattenFolderViews(view.children, out);
  }
  if (n !== view && Array.isArray(n.children)) {
    flattenFolderViews(n.children, out);
  }
  return out;
}

export async function listAllViewsDeep(workspaceId: string): Promise<AppFlowyView[]> {
  const now = Date.now();
  const cached = cachedViewsByWorkspace.get(workspaceId);
  if (cached && cached.expiresAtMs > now) {
    return cached.value;
  }

  try {
    const r = await callThrowing<{ data: unknown }>(`/workspace/${workspaceId}/folder?depth=10`, {
      timeoutMs: 30_000,
    });
    const views = flattenFolderViews(r.data);
    if (views.length > 0) {
      // Deduplicate by view_id (folder walk can revisit parents).
      const byId = new Map<string, AppFlowyView>();
      for (const v of views) byId.set(v.view_id, v);
      const value = Array.from(byId.values());
      cachedViewsByWorkspace.set(workspaceId, {
        value,
        expiresAtMs: now + VIEWS_TTL_MS,
      });
      return value;
    }
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    // Fall through to admin API.
  }

  try {
    const r = await callThrowing<{ data: AppFlowyView[] }>(`/admin/workspace/${workspaceId}/views`);
    const value = r.data ?? [];
    cachedViewsByWorkspace.set(workspaceId, {
      value,
      expiresAtMs: now + VIEWS_TTL_MS,
    });
    return value;
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    throw e;
  }
}

/** Keys adapters parse from CMS page bodies (longest-first to avoid Price⊂StripePriceId). */
const CMS_FIELD_KEYS = [
  "StripePriceId",
  "Description",
  "CoverImage",
  "Challenge",
  "Solution",
  "Results",
  "Category",
  "Features",
  "Industry",
  "Summary",
  "Company",
  "Service",
  "Featured",
  "Published",
  "Locale",
  "Answer",
  "Client",
  "Rating",
  "Quote",
  "Price",
  "Order",
  "Slug",
  "Icon",
  "Name",
  "Role",
  "Tags",
  "Date",
  "CTA",
] as const;

function extractStringsFromCollab(encoded: unknown): string {
  if (!encoded) return "";
  let blob: Buffer;
  if (Array.isArray(encoded)) {
    blob = Buffer.from(encoded as number[]);
  } else if (typeof encoded === "string") {
    try {
      blob = Buffer.from(encoded, "base64");
    } catch {
      blob = Buffer.from(encoded, "utf8");
    }
  } else if (Buffer.isBuffer(encoded)) {
    blob = encoded;
  } else {
    return "";
  }

  const latin = blob.toString("latin1");
  // Markdown `**Key**: value` is stored as rich-text bold(Key) + ": value".
  // Reconstruct from CRDT bytes where the key string sits near `: value'`.
  const fields: string[] = [];
  for (const key of CMS_FIELD_KEYS) {
    const keyRe = new RegExp(`(?:^|[^A-Za-z])${key}(?![A-Za-z])`, "g");
    let match: RegExpExecArray | null;
    while ((match = keyRe.exec(latin)) !== null) {
      const window = latin.slice(
        match.index + match[0].length,
        match.index + match[0].length + 900
      );
      const valueMatch = /:\s*([^']{1,800})'/.exec(window);
      if (valueMatch?.[1]) {
        const value = Buffer.from(valueMatch[1], "latin1")
          .toString("utf8")
          .replace(/[\u0000-\u001f\u007f-\u009f\ufffd]+/g, "")
          .replace(/[^\w\s.,;:!?'"€$%()/%+\-–—/]+$/u, "")
          .replace(/\s+/g, " ")
          .trim();
        if (value) {
          fields.push(`**${key}**: ${value}`);
          break;
        }
      }
    }
  }
  if (fields.length > 0) {
    return Array.from(new Set(fields)).join("\n");
  }

  const matches = latin.match(/[\x20-\x7e]{4,}/g) ?? [];
  const skip = new Set([
    "data",
    "document",
    "blocks",
    "meta",
    "children_map",
    "text_map",
    "page_id",
    "page",
    "parent",
    "children",
    "external_id",
    "external_type",
    "paragraph",
    "text",
    "bold",
    "true",
    "null",
  ]);
  return matches
    .map((raw) => raw.replace(/'+$/g, "").trim())
    .filter((s) => {
      if (!s || skip.has(s)) return false;
      if (s.startsWith("$") || s.startsWith("w$")) return false;
      if (/^[A-Za-z0-9_-]{6,14}\(?$/.test(s)) return false;
      if (/^\*\*[A-Za-z][^*]+\*\*:/.test(s)) return true;
      if (s.includes(" ") && s.length >= 24) return true;
      return false;
    })
    .join("\n");
}

export async function getDocument(workspaceId: string, viewId: string): Promise<unknown> {
  try {
    const r = await callThrowing<{
      data?: {
        view?: AppFlowyView;
        data?: { encoded_collab?: unknown; row_data?: unknown };
      };
    }>(`/workspace/${workspaceId}/page-view/${viewId}`);
    const encoded = r.data?.data?.encoded_collab;
    const text = extractStringsFromCollab(encoded);
    return { text, content: text ? [text] : [], raw: r.data };
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) throw e;
    // Fall through to admin document endpoint.
  }

  try {
    const r = await callThrowing<{ data: unknown }>(
      `/admin/workspace/${encodeURIComponent(workspaceId)}/document/${encodeURIComponent(viewId)}`
    );
    return r.data;
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) throw e;
    throw e;
  }
}

export async function extractDocText(doc: unknown): Promise<string> {
  try {
    const data = doc as { text?: string; content?: unknown[] };
    if (data.text) return data.text;
    if (Array.isArray(data.content)) {
      return data.content
        .map((c) => {
          if (typeof c === "string") return c;
          if (c && typeof c === "object" && "text" in c)
            return String((c as { text: unknown }).text);
          return "";
        })
        .join("\n");
    }
    return "";
  } catch {
    return "";
  }
}

export async function markdownToHtml(markdown: string): Promise<string> {
  return markdown
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

export async function listWorkspaceViews(workspaceId: string): Promise<AppFlowyView[]> {
  return listAllViewsDeep(workspaceId);
}

export async function searchDocuments(workspaceId: string, query: string): Promise<AppFlowyView[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  try {
    const views = await listAllViewsDeep(workspaceId);
    return views.filter((v) => v.name.toLowerCase().includes(q));
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return [];
    throw e;
  }
}

/** Rename a page/view (used for editorial status via [Draft]/[Review]/[Archived] prefixes). */
export async function updateViewName(
  workspaceId: string,
  viewId: string,
  name: string
): Promise<boolean> {
  try {
    const res = await appflowyFetch(`/workspace/${workspaceId}/page-view`, {
      method: "PATCH",
      body: JSON.stringify({ view_id: viewId, name }),
    });
    cachedViewsByWorkspace.delete(workspaceId);
    return res.ok;
  } catch (e) {
    if (e instanceof AppFlowyNotConfiguredError) return false;
    console.error("[appflowy] updateViewName failed:", e);
    return false;
  }
}

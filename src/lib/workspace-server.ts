/** * Multi-tenant workspace plumbing. * * D1 primary (Cloudflare Workers) - D1 config table with key "WORKSPACES_JSON" * SSM fallback (AWS Lambda) - Legacy support during transition * * Note: This file now uses D1 as primary storage. SSM fallback remains for AWS Lambda compatibility. */import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { AuthDatabase } from "@/lib/auth-d1";
import { isAdmin, requireAuth, type AuthResult, type DecodedToken } from "@/lib/api-auth";

/** Cookie key that carries the active workspace id between client/server.
 * Mirrors `localStorage[cloudless_workspace_id]` set by WorkspaceContext.
 * Browser sends it on same-origin requests; route handlers + RSC reads it.
 */
export const WORKSPACE_COOKIE = "cloudless_workspace_id";
/** Configuration key for workspaces list in D1 config table. */
export const D1_KEY = "WORKSPACES_JSON";

const CACHE_TTL_MS = 30_000;

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as { AUTH_DB: AuthDatabase };
  return env.AUTH_DB ?? null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  adminEmails: string[];
  createdAt: string;
  /** Optional Postiz "group" (customer) id this workspace maps to. When set, * Postiz API calls automatically filter integrations + posts by this group * so each workspace sees only its own connected channels. Created/edited * via the workspaces PATCH route. */
  postizGroupId?: string;
  /** Optional Notion tag string written into the `WorkspaceID` column on * content-calendar rows. When set, the calendar API filters its query by * this id so each workspace sees only its own calendar items. */
  notionTag?: string;
}

interface WorkspaceCache {
  data: Workspace[];
  expiresAt: number;
}

let cached: WorkspaceCache | null = null;

/** Reset the cache — primarily for tests. */
export function resetWorkspaceCache(): void {
  cached = null;
}

async function readFromD1(): Promise<Workspace[] | null> {
  const db = getAuthDb();
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT value FROM config WHERE key = ?")
      .bind(D1_KEY)
      .first<{ value: string }>();
    if (row?.value) {
      const data = JSON.parse(row.value) as Workspace[];
      if (Array.isArray(data)) {
        cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return data;
      }
    }
  } catch (err) {
    console.warn("[workspace-server] D1 read failed:", err instanceof Error ? err.message : err);
  }
  return null;
}

async function writeToD1(workspaces: Workspace[]): Promise<void> {
  const db = getAuthDb();
  if (!db) throw new Error("D1 not available");
  await db
    .prepare(
      "INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(D1_KEY, JSON.stringify(workspaces), Math.floor(Date.now() / 1000))
    .run();
}

export async function readWorkspaces(): Promise<Workspace[]> {
  // Try D1 first (Cloudflare Workers - primary storage)
  const db = getAuthDb();
  if (db) {
    const d1Result = await readFromD1();
    if (d1Result) return d1Result;
  }

  // Fallback to empty array if D1 unavailable
  return cached?.data ?? [];
}

export async function writeWorkspaces(workspaces: Workspace[]): Promise<void> {
  // Try D1 first (Cloudflare Workers - primary storage)
  const db = getAuthDb();
  if (db) {
    try {
      await writeToD1(workspaces);
      cached = { data: workspaces, expiresAt: Date.now() + CACHE_TTL_MS };
      return;
    } catch (err) {
      console.warn(
        "[workspace-server] D1 write failed, cache updated:",
        err instanceof Error ? err.message : err
      );
      // Continue with cache update
    }
  }

  // Update cache even if D1 unavailable
  cached = { data: workspaces, expiresAt: Date.now() + CACHE_TTL_MS };
}

/***
 * Resolve the active workspace id from the request cookie. Falls back to the
 * RSC cookies() store when no NextRequest is provided (server-component
 * usage). Returns `null` when no cookie is present.
 */
export async function getActiveWorkspaceId(request?: NextRequest): Promise<string | null> {
  if (request) {
    return request.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
  }
  try {
    const store = await cookies();
    return store.get(WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/***
 * Resolve the full active workspace (cookie id + D1/SSM lookup). Returns `null`
 * when the cookie is missing OR the id no longer exists.
 */
export async function getActiveWorkspace(request?: NextRequest): Promise<Workspace | null> {
  const id = await getActiveWorkspaceId(request);
  if (!id) return null;
  const list = await readWorkspaces();
  return list.find((w) => w.id === id) ?? null;
}

export type WorkspaceAuthResult =
  { ok: true; user: DecodedToken; workspace: Workspace } | { ok: false; response: NextResponse };

/***
 * Pure authorization decision: determine if a user has access to a workspace.
 * Returns "granted" | "no_workspace" | "forbidden".
 * Exported for testability — the actual gate wraps this with I/O.
 */
export function checkWorkspaceAccess(
  user: DecodedToken,
  workspace: Workspace | null,
  isGlobalAdmin: boolean
): "granted" | "no_workspace" | "forbidden" {
  if (!workspace) return "no_workspace";
  if (isGlobalAdmin) return "granted";
  const email = user.email?.toLowerCase();
  if (email && workspace.adminEmails.some((e) => e.toLowerCase() === email)) return "granted";
  return "forbidden";
}

/***
 * Workspace-scoped admin gate.
 *
 * Decision tree:
 * 1. Caller must pass `requireAuth` (valid session or Bearer JWT).
 * 2. The active workspace cookie must point at an existing workspace.
 * 3. EITHER the caller is a global admin (Cognito `admin` group) —
 * access granted to ANY workspace — OR the caller's email is listed
 * in `workspace.adminEmails` — access granted to THIS workspace.
 * 4. Otherwise 403.
 *
 * `requireAdmin` (the global gate) is unchanged; this is purely additive.
 * Routes opt in by calling `requireWorkspaceAdmin` instead.
 */
export async function requireWorkspaceAdmin(request: NextRequest): Promise<WorkspaceAuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  const workspace = await getActiveWorkspace(request);
  const decision = checkWorkspaceAccess(authResult.user, workspace, authResult.user.isAdmin);

  if (decision === "no_workspace") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No active workspace selected", code: "no_workspace" },
        { status: 400 }
      ),
    };
  }

  if (decision === "forbidden") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace admin access required" }, { status: 403 }),
    };
  }

  return { ok: true, user: authResult.user, workspace: workspace! };
}
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth, type AuthResult, type DecodedToken } from "@/lib/api-auth";
import { readJsonConfig, writeJsonConfig } from "@/lib/app-config-json";

/**
 * Multi-tenant workspace plumbing.
 *
 * Canonical home for:
 *   - the `Workspace` shape (persisted as JSON in D1 app_config)
 *   - read/write with a 30s cache
 *   - cookie/localStorage active-workspace plumbing
 *   - `requireWorkspaceAdmin` — admin gate scoped to a workspace's adminEmails
 *
 * The `/api/admin/workspaces` route imports from here so the type + helpers
 * are not duplicated.
 */

/** Cookie key that carries the active workspace id between client/server.
 *  Mirrors `localStorage[cloudless_workspace_id]` set by WorkspaceContext.
 *  Browser sends it on same-origin requests; route handlers + RSC reads it. */
export const WORKSPACE_COOKIE = "cloudless_workspace_id";

/** D1 app_config key that stores the entire workspaces list as a JSON array. */
export const WORKSPACES_CONFIG_KEY = "WORKSPACES_JSON";
/** @deprecated alias — was SSM path */
export const SSM_KEY = WORKSPACES_CONFIG_KEY;

const CACHE_TTL_MS = 30_000;

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  adminEmails: string[];
  createdAt: string;
  /** Optional Postiz "group" (customer) id this workspace maps to. When set,
   *  Postiz API calls automatically filter integrations + posts by this group
   *  so each workspace sees only its own connected channels. Created/edited
   *  via the workspaces PATCH route. */
  postizGroupId?: string;
  /** Optional Notion tag string written into the `WorkspaceID` column on
   *  content-calendar rows. When set, the calendar API filters its query by
   *  this id so each workspace sees only its own calendar items. */
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

export async function readWorkspaces(): Promise<Workspace[]> {
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const data = await readJsonConfig<Workspace[]>(WORKSPACES_CONFIG_KEY, []);
  const list = Array.isArray(data) ? data : [];
  cached = { data: list, expiresAt: Date.now() + CACHE_TTL_MS };
  return list;
}

export async function writeWorkspaces(workspaces: Workspace[]): Promise<void> {
  await writeJsonConfig(WORKSPACES_CONFIG_KEY, workspaces, "Multi-tenant workspaces");
  cached = { data: workspaces, expiresAt: Date.now() + CACHE_TTL_MS };
}

/** Resolve the active workspace id from the request cookie. Falls back to the
 *  RSC cookies() store when no NextRequest is provided (server-component
 *  usage). Returns `null` when no cookie is present. */
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

/** Resolve the full active workspace (cookie id + SSM lookup). Returns `null`
 *  when the cookie is missing OR the id no longer exists. */
export async function getActiveWorkspace(request?: NextRequest): Promise<Workspace | null> {
  const id = await getActiveWorkspaceId(request);
  if (!id) return null;
  const list = await readWorkspaces();
  return list.find((w) => w.id === id) ?? null;
}

export type WorkspaceAuthResult =
  { ok: true; user: DecodedToken; workspace: Workspace } | { ok: false; response: NextResponse };

/**
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

/**
 * Workspace-scoped admin gate.
 *
 * Decision tree:
 *   1. Caller must pass `requireAuth` (valid session or Bearer JWT).
 *   2. The active workspace cookie must point at an existing workspace.
 *   3. EITHER the caller is a global admin (Cognito `admin` group) —
 *      access granted to ANY workspace — OR the caller's email is listed
 *      in `workspace.adminEmails` — access granted to THIS workspace.
 *   4. Otherwise 403.
 *
 * `requireAdmin` (the global gate) is unchanged; this is purely additive.
 * Routes opt in by calling `requireWorkspaceAdmin` instead.
 */
export async function requireWorkspaceAdmin(request: NextRequest): Promise<WorkspaceAuthResult> {
  const authResult: AuthResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  const workspace = await getActiveWorkspace(request);
  const decision = checkWorkspaceAccess(authResult.user, workspace, isAdmin(authResult.user));

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

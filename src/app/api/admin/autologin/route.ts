/**
 * GET /api/admin/autologin?app=<appname>
 *
 * Admin-only endpoint that returns a launch URL for a self-hosted app tile.
 * For AppFlowy: performs a GoTrue password-grant and returns a deep-link URL
 * with the access token embedded in the URL hash.
 * For all other apps: returns the canonical admin URL (no token).
 *
 * Security:
 * - requireAdmin() enforces admin-group membership.
 * - Token values are never echoed in error messages or logs.
 * - The returned URL is intended to be opened in a new browser tab immediately;
 *   callers MUST NOT store it.
 *
 * Response shape:
 *   200 { url: string; app: string; hasToken: boolean }
 *   400 { error: string }   — unknown ?app value
 *   401 / 403               — from requireAdmin()
 *   502 { error: string }   — upstream GoTrue call failed
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getAutologinUrl,
  type SelfhostedApp,
  SELFHOSTED_APP_NAMES,
} from "@/lib/selfhosted-autologin";
import { sanitizeForLog } from "@/lib/escape-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_APPS = new Set<SelfhostedApp>(Object.keys(SELFHOSTED_APP_NAMES) as SelfhostedApp[]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const appParam = searchParams.get("app") ?? "";

  if (!VALID_APPS.has(appParam as SelfhostedApp)) {
    return NextResponse.json(
      {
        error: `Unknown app. Valid values: ${[...VALID_APPS].join(", ")}`,
      },
      { status: 400 }
    );
  }

  const app = appParam as SelfhostedApp;

  try {
    const result = await getAutologinUrl(app);
    return NextResponse.json(
      { url: result.url, app, hasToken: result.hasToken },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    // Deliberately strip any secret values from the error message before logging.
    const raw = err instanceof Error ? err.message : String(err);
    const safe = sanitizeForLog(raw.replace(/[A-Za-z0-9_\-]{40,}/g, "[REDACTED]"));
    console.error("[autologin] Error fetching URL for app:", app, safe);
    return NextResponse.json({ error: "Failed to get login URL" }, { status: 502 });
  }
}

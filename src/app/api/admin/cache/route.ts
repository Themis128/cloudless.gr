import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { invalidateCache } from "@/lib/notion-cache";
import { mapIntegrationError } from "@/lib/api-errors";

/**
 * POST /api/admin/cache
 *
 * Flushes the in-memory Notion cache. Pass an optional `prefix` in the JSON body
 * to target a specific cache namespace (e.g. "blog", "forms").
 * Without a prefix, the entire cache is cleared.
 *
 * @auth Requires Cognito JWT with `admin` group (401 / 403).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let prefix: string | undefined;
  try {
    const body = await request.json();
    prefix = typeof body.prefix === "string" ? body.prefix : undefined;
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    // No body -- clear everything
  }

  invalidateCache(prefix);

  return NextResponse.json({
    ok: true,
    clearedPrefix: prefix ?? "(all)",
    clearedAt: new Date().toISOString(),
  });
}

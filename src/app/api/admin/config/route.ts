import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAuthDbFromEnv } from "@/lib/auth-d1";
import { getD1ConfigValue, setD1ConfigValue } from "@/lib/ssm-config-d1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Keys that must never be written via this admin API (use Wrangler/k8s secrets). */
const BLOCKED_KEYS = new Set([
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SESSION_SECRET",
  "AUTH_SECRET",
  "COGNITO_CLIENT_SECRET",
  "GOOGLE_PRIVATE_KEY",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
]);

/**
 * GET /api/admin/config?key=FOO — read one app_config value (admin).
 * GET /api/admin/config — list keys (no values).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ configured: false, error: "AUTH_DB not bound" }, { status: 503 });
  }

  const key = new URL(request.url).searchParams.get("key")?.trim();
  if (key) {
    if (BLOCKED_KEYS.has(key)) {
      return NextResponse.json({ error: "Secret keys are not readable via this API" }, { status: 403 });
    }
    const value = await getD1ConfigValue(db as unknown as D1Database, key);
    if (value === undefined) {
      return NextResponse.json({ error: "Not found", key }, { status: 404 });
    }
    return NextResponse.json({ key, value });
  }

  const rows = await (db as unknown as D1Database)
    .prepare("SELECT key, description, updated_at FROM app_config ORDER BY key")
    .all<{ key: string; description: string | null; updated_at: number }>();

  return NextResponse.json({
    configured: true,
    configs: rows.results ?? [],
    count: (rows.results ?? []).length,
  });
}

/**
 * PUT /api/admin/config — { key, value, description? }
 * Writes non-secret app_config rows (Cloudflare D1).
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ configured: false, error: "AUTH_DB not bound" }, { status: 503 });
  }

  let body: { key?: unknown; value?: unknown; description?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const value = typeof body.value === "string" ? body.value : null;
  const description = typeof body.description === "string" ? body.description : undefined;

  if (!key || key.length > 128 || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
    return NextResponse.json(
      { error: "key must be UPPER_SNAKE_CASE (max 128)" },
      { status: 400 }
    );
  }
  if (BLOCKED_KEYS.has(key)) {
    return NextResponse.json(
      { error: "Secret keys must be set via Wrangler/k8s secrets, not app_config" },
      { status: 403 }
    );
  }
  if (value === null) {
    return NextResponse.json({ error: "value string required" }, { status: 400 });
  }
  if (value.length > 8000) {
    return NextResponse.json({ error: "value too long" }, { status: 400 });
  }

  await setD1ConfigValue(db as unknown as D1Database, key, value, description);
  return NextResponse.json({ ok: true, key });
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Env {
  AUTH_DB: D1Database;
}

interface AppConfig {
  key: string;
  value: string | null;
  description: string | null;
  updated_at: number;
}

function getDb(_request: NextRequest): D1Database | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

export async function GET(req: NextRequest) {
  const db = getDb(req);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 404 });
  }

  if (key) {
    // Get specific config key
    try {
      const result = await db
        .prepare("SELECT key, value, description, updated_at FROM app_config WHERE key = ?")
        .bind(key)
        .first<AppConfig>();

      if (!result) {
        return NextResponse.json({ error: "Config key not found", key }, { status: 404 });
      }

      return NextResponse.json({
        key: result.key,
        value: result.value,
        description: result.description,
        updated_at: result.updated_at,
      });
    } catch (err) {
      console.error("[api/config] error:", err);
      return NextResponse.json(
        { error: "Database error", message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // List all configs (without values for security)
  try {
    const results = await db
      .prepare("SELECT key, description, updated_at FROM app_config ORDER BY key")
      .all<AppConfig>();

    return NextResponse.json({
      configs: results.results,
      count: results.results.length,
    });
  } catch (err) {
    console.error("[api/config] error:", err);
    return NextResponse.json(
      { error: "Database error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

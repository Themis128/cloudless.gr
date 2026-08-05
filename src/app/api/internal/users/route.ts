import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Env {
  AUTH_DB: D1Database;
}

interface User {
  id: string;
  username: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  preferences_json: string | null;
  created_at: number;
  updated_at: number;
}

function getDb(_request: NextRequest): D1Database | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

export async function GET(req: NextRequest) {
  const db = getDb(req);

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 1000);
  const includeDetails = url.searchParams.get("details") === "true";

  try {
    let total: number;
    let results: D1Result<User>;

    if (includeDetails) {
      results = await db
        .prepare("SELECT id, username, email, name, company, phone, preferences_json, created_at, updated_at FROM user ORDER BY created_at DESC")
        .all<User>();
      total = results.results.length;
    } else {
      // Get total count for pagination
      const countResult = await db.prepare("SELECT COUNT(*) as count FROM user").first<{ count: number }>();
      total = countResult?.count ?? 0;

      results = await db
        .prepare("SELECT id, username, email, name, company, phone, created_at, updated_at FROM user LIMIT ?")
        .bind(limit)
        .all<User>();
    }

    // Transform data to match what the ETL script expects
    const users = results.results.map((u) => ({
      user_id: u.id,
      email: u.email,
      name: u.name,
      company: u.company,
      phone: u.phone,
      signup_date: new Date(u.created_at * 1000).toISOString(),
      last_login: new Date(u.updated_at * 1000).toISOString(),
      email_verified: true, // Assume verified for users in the database
    }));

    return NextResponse.json({
      users,
      count: users.length,
      total,
      limit,
    });
  } catch (err) {
    console.error("[api/internal/users] error:", err);
    return NextResponse.json(
      { error: "Database error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
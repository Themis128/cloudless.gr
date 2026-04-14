import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { searchPages, searchDatabases, listUsers, getDatabaseSchema } from "@/lib/notion-search";

/**
 * GET /api/admin/notion/search?q=...&type=page|database&limit=20
 *
 * Search Notion pages/databases or list users.
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") as "page" | "database" | "users" | "schema" | null;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  try {
    if (type === "users") {
      const users = await listUsers();
      return NextResponse.json({ users });
    }

    if (type === "schema") {
      const dbId = searchParams.get("database_id");
      if (!dbId) {
        return NextResponse.json({ error: "database_id is required" }, { status: 400 });
      }
      const schema = await getDatabaseSchema(dbId);
      return NextResponse.json({ schema });
    }

    if (type === "database") {
      const results = await searchDatabases(q, limit);
      return NextResponse.json({ results });
    }

    // Default: search all
    const data = await searchPages(q, {
      filter: type === "page" ? "page" : undefined,
      limit,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API] Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

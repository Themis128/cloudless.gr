/**
 * GET /api/admin/analytics/lake-catalog — allowlisted bronze parquet entries.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { LAKE_PARQUET_CATALOG } from "@/lib/lake-parquet-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { catalog: LAKE_PARQUET_CATALOG },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

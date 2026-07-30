/**
 * GET /api/admin/analytics/lake-parquet?id=<catalogId>
 * Streams allowlisted bronze parquet from R2. Catalog-only — no free-form paths.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { lakeParquetPathById } from "@/lib/lake-parquet-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get("id") || "";
  const path = lakeParquetPathById(id);
  if (!path) {
    return NextResponse.json(
      { error: "unknown_catalog_id", hint: "Use GET /api/admin/analytics/lake-catalog" },
      { status: 400 }
    );
  }

  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) {
    return NextResponse.json({ error: "datalake_unbound" }, { status: 503 });
  }

  const object = await bucket.get(path);
  if (!object) {
    return NextResponse.json({ error: "not_found", path }, { status: 404 });
  }

  const body = await object.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, max-age=120",
      "X-Lake-Path": path,
    },
  });
}

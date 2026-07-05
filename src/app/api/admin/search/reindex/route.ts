/**
 * POST /api/admin/search/reindex — Rebuild the Meilisearch product index.
 *
 * Requires admin authentication.
 */

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { syncAllProducts } from "@/lib/search-index";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await syncAllProducts();
    return Response.json(result);
  } catch (err) {
    console.error("[Admin Search Reindex] Error:", err);
    return Response.json(
      { indexed: 0, configured: false, error: "Reindex failed" },
      { status: 500 }
    );
  }
}

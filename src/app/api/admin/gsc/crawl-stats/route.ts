import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCrawlStats } from "@/lib/gsc-admin";

/**
 * GET /api/admin/gsc/crawl-stats — crawl error samples and stats
 * Returns: { samples: [{ category, pageCount, sampleUrls }], siteUrl }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getCrawlStats();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC crawl-stats] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

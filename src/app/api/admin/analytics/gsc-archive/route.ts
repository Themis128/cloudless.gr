import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

import { IntegrationNotConfiguredError } from "@/lib/integrations";

/**
 * Persisted weekly GSC archive (written by scripts/weekly-gsc-sync.ts into the
 * NOTION_GSC_REPORTS_DB_ID database). Distinct from /api/admin/analytics/history,
 * which queries the GSC API live — this serves the durable Notion-backed record.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const DEFAULT_LIMIT = 26;
  const MAX_LIMIT = 100;
  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT)), MAX_LIMIT)
  );

  try {
    const reports = await getGscReports(limit);
    if (reports === null) {
      return NextResponse.json(
        { error: "Failed to read the GSC archive from Notion." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      reports,
      count: reports.length,
      fetchedAt: new Date().toISOString(),
      source: "notion",
    });
  } catch (err) {
    if (err instanceof IntegrationNotConfiguredError) {
      return NextResponse.json(
        { error: "GSC archive not configured (NOTION_GSC_REPORTS_DB_ID).", reports: [] },
        { status: 503 }
      );
    }
    console.error("[GSC archive] Error:", err);
    return NextResponse.json({ error: "Failed to fetch GSC archive." }, { status: 500 });
  }
}

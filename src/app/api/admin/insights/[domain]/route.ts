/**
 * GET /api/admin/insights/[domain] — single gold insight snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { assertInsightDomain, getInsight } from "@/lib/datalake-serve";
import { INSIGHT_DOMAINS } from "@/lib/datalake-insights";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { domain: raw } = await params;
  const domain = assertInsightDomain(raw);
  if (!domain) {
    return NextResponse.json(
      {
        error: `Unknown insight domain. Allowed: ${INSIGHT_DOMAINS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const insight = await getInsight(domain);
  if (!insight) {
    return NextResponse.json(
      {
        domain,
        generated_at: null,
        summary: "",
        bullets: [],
        metrics_cited: [],
        error: "not available (run materialize-datalake-insights)",
        source: "datalake-gold",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ...insight, source: "datalake-gold" });
}

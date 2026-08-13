/**
 * GET /api/admin/insights — list gold insight domains from the datalake.
 * Lake-only; never calls live vendors or LLMs.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listInsightDomains } from "@/lib/datalake-serve";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const index = await listInsightDomains();
  return NextResponse.json({
    cache: "cloudflare",
    source: "datalake-gold",
    ...index,
  });
}

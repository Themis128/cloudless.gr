import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listReports } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const reports = listReports();
  return NextResponse.json({ reports, total: reports.length });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getReport, deleteReport } from "@/lib/reports";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const report = getReport(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json({ report });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = deleteReport(id);
  if (!deleted) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

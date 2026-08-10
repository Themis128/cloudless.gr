/**
 * /api/admin/appflowy/docs — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDocs } from "@/lib/appflowy-docs";
import { isAppFlowyConfigured } from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
  }

  try {
    const docs = await getDocs();
    return NextResponse.json({ docs, count: docs.length });
  } catch (err) {
    console.error("[Admin AppFlowy Docs] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list docs" }, { status: 500 });
  }
}
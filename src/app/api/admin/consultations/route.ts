import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getUpcomingConsultations } from "@/lib/cal-com";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"))) {
    return NextResponse.json({ consultations: [], configured: false });
  }

  try {
    const consultations = await getUpcomingConsultations();
    return NextResponse.json({ consultations, configured: true });
  } catch (err) {
    console.error("[admin/consultations] fetch failed:", err);
    return NextResponse.json({ consultations: [], configured: true, error: "Fetch failed" });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isPostizConfigured, listPostizIntegrations } from "@/lib/postiz";

/** Postiz health + connected channels — used by the calendar UI and the integrations dashboard. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isPostizConfigured())) {
    return NextResponse.json({ error: "Postiz not configured." }, { status: 503 });
  }

  const integrations = await listPostizIntegrations();
  return NextResponse.json({
    integrations,
    total: integrations.length,
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * /api/admin/notion/status — checks Notion integration health
 *
 * Error sanitization: Returns generic error code instead of raw err.message
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured, pingAppFlowyHealth } from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const configured = await isAppFlowyConfigured();
    const healthy = configured ? await pingAppFlowyHealth() : false;

    return NextResponse.json({
      configured,
      healthy,
    });
  } catch (err) {
    console.error("[Notion Status] Error checking status:", err); // Server-side logging preserved
    return NextResponse.json(
      {
        configured: false,
        healthy: false,
        error: "upstream-notion-error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listRecentExecutions, isN8nConfigured } from "@/lib/n8n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const configured = await isN8nConfigured();
  if (!configured) {
    return NextResponse.json({ error: "n8n_not_configured" }, { status: 503 });
  }

  const limit = Math.min(
    250,
    Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? "50"))
  );
  const executions = await listRecentExecutions(limit);
  return NextResponse.json({ executions });
}

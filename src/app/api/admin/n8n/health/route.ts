import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isN8nConfigured, pingN8nHealth, listWorkflows, listRecentExecutions } from "@/lib/n8n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const configured = await isN8nConfigured();
  if (!configured) {
    return NextResponse.json(
      { ok: false, configured: false, error: "n8n_not_configured" },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  const [healthy, workflows, executions] = await Promise.all([
    pingN8nHealth(),
    listWorkflows(false).catch(() => []),
    listRecentExecutions(50).catch(() => []),
  ]);
  const latencyMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: healthy,
    configured: true,
    latencyMs,
    workflows: {
      total: workflows.length,
      active: workflows.filter((w) => w.active).length,
    },
    executions: {
      recent: executions.length,
      errors: executions.filter((e) => e.status === "error").length,
      running: executions.filter((e) => e.status === "running").length,
    },
  });
}

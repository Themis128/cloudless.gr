/**
 * POST /api/admin/insights/refresh — admin trigger for insight materialize.
 *
 * Does NOT call vendors or LLMs in-process. Records a refresh request and
 * returns instructions to run the ETL workflow (GitHub Actions on omv).
 * Optional: if INSIGHTS_REFRESH_HOOK_URL is set, POSTs to that webhook.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordNotification } from "@/lib/admin-notifications";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const hook = process.env.INSIGHTS_REFRESH_HOOK_URL?.trim();
  let hookStatus: "skipped" | "ok" | "failed" = "skipped";

  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "materialize-datalake-insights",
          requestedBy: auth.user.email ?? auth.user.sub,
          at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      hookStatus = res.ok ? "ok" : "failed";
    } catch {
      hookStatus = "failed";
    }
  }

  recordNotification({
    category: "portal",
    type: "info",
    title: "Datalake insights refresh requested",
    message: `hook=${hookStatus}`,
    actor: auth.user.email ?? auth.user.sub,
    route: "/api/admin/insights/refresh",
  });

  return NextResponse.json({
    ok: true,
    hookStatus,
    message:
      hookStatus === "ok"
        ? "Refresh webhook accepted."
        : "Refresh recorded. Run workflow ETL: Materialize datalake insights (or wait for hourly :50 UTC).",
    workflow: "etl-materialize-insights.yml",
  });
}

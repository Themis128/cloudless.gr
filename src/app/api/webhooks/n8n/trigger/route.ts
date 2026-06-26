/**
 * POST /api/webhooks/n8n/trigger
 * ──────────────────────────────
 * Fires an n8n workflow by ID. Used by app-side events that want to delegate
 * follow-up automation to n8n (lead enrichment, newsletter nurture, etc.)
 * instead of building all the integrations server-side.
 *
 * Two callers today:
 *   - `src/app/api/webhooks/espocrm/route.ts` — Lead.create → enrich workflow
 *   - `src/app/api/subscribe/route.ts`         — newsletter signup → nurture
 *
 * Both halves of the app reuse the same path (Next.js Lambda + future
 * Pi-side scripts can POST to /api/webhooks/n8n/trigger).
 *
 * Body:
 *   {
 *     "workflowId": "<n8n-workflow-uuid>",   // OR omit if `name` matches a known wf
 *     "name":       "lead-enrich",           // OR one of the well-known aliases
 *     "payload":    { ... }                   // forwarded as-is to the workflow
 *   }
 *
 * Auth: `x-n8n-trigger-secret` header checked against SSM
 *       `NOTION_WEBHOOK_SECRET` (reused — it's a shared "internal" secret).
 *
 * Returns 200 with the n8n execution-trigger response, OR 502 on n8n
 * failure, OR 503 when n8n isn't configured (graceful — operator may not
 * have wired up the n8n workflow IDs yet).
 */
import { NextRequest, NextResponse } from "next/server";
import { triggerWorkflowByWebhookPath } from "@/lib/n8n";
import { getConfig } from "@/lib/ssm-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Well-known aliases — keeps callers from needing to know UUIDs. The
// underlying ID still comes from SSM (`N8N_WORKFLOW_LEAD_ENRICH_ID`, etc.)
// so the operator can swap workflow versions without a redeploy.
const NAME_TO_SSM_KEY: Record<string, keyof Awaited<ReturnType<typeof getConfig>>> = {
  "lead-enrich": "N8N_WORKFLOW_LEAD_ENRICH_ID",
  "newsletter-nurture": "N8N_WORKFLOW_NEWSLETTER_NURTURE_ID",
};

async function verifySecret(req: NextRequest): Promise<boolean> {
  const cfg = await getConfig();
  const expected = cfg.CONTENT_WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.headers.get("x-n8n-trigger-secret");
  if (!got || got.length !== expected.length) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
}

export async function POST(req: NextRequest) {
  if (!(await verifySecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { workflowId?: string; name?: string; payload?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let workflowId = body.workflowId;
  if (!workflowId && body.name) {
    const cfg = await getConfig();
    const ssmKey = NAME_TO_SSM_KEY[body.name];
    if (!ssmKey) {
      return NextResponse.json({ error: `unknown workflow alias: ${body.name}` }, { status: 400 });
    }
    workflowId = (cfg[ssmKey] as string) || "";
  }

  if (!workflowId) {
    // Graceful — operator hasn't created the workflow yet OR didn't write the
    // ID to SSM. We don't want to fail callers' core path over a missing
    // automation; return 204 No Content so they treat it as "noop".
    return NextResponse.json({ ok: false, skipped: "no workflow ID configured" }, { status: 204 });
  }

  try {
    const result = await triggerWorkflowByWebhookPath(workflowId, body.payload ?? {});
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = (err as Error).message;
    if (/not\s*configured/i.test(msg)) {
      return NextResponse.json({ error: "n8n_not_configured", detail: msg }, { status: 503 });
    }
    console.error("[n8n trigger] failed:", err);
    return NextResponse.json({ error: "n8n_upstream_failed", detail: msg }, { status: 502 });
  }
}

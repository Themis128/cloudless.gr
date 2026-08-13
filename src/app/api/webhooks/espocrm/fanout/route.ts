import { NextRequest, NextResponse } from "next/server";
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";
import {
  notifyCaseCreated,
  notifyCaseStatusChanged,
  notifyContactCreated,
  notifyLeadCreated,
  notifyOpportunityCreated,
  notifyOpportunityStageChanged,
} from "@/lib/espocrm-slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/espocrm/fanout — called by the espocrm-fanout Queue consumer.
 * Auth: Bearer ESPOCRM_QUEUE_PRODUCER_SECRET (same secret as the producer Worker).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ESPOCRM_QUEUE_PRODUCER_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "queue_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { entity?: string; action?: string; records?: EspoEntityRecord[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const entity = String(body.entity ?? "");
  const action = String(body.action ?? "");
  const records = Array.isArray(body.records) ? body.records : [];
  if (!entity || !action) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  await dispatchFanout(entity, action, records);
  return NextResponse.json({ ok: true, dispatched: records.length });
}

async function dispatchFanout(
  entity: string,
  action: string,
  records: EspoEntityRecord[]
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const rec of records ?? []) {
    if (entity === "Contact" && action === "create") tasks.push(notifyContactCreated(rec));
    else if (entity === "Lead" && action === "create") {
      tasks.push(notifyLeadCreated(rec));
      tasks.push(triggerN8n("lead-enrich", { entity, action, record: rec }));
    } else if (entity === "Opportunity" && action === "create")
      tasks.push(notifyOpportunityCreated(rec));
    else if (entity === "Opportunity" && action === "update" && rec.stage)
      tasks.push(notifyOpportunityStageChanged(rec));
    else if (entity === "Case" && action === "create") tasks.push(notifyCaseCreated(rec));
    else if (entity === "Case" && action === "update" && rec.status)
      tasks.push(notifyCaseStatusChanged(rec));
  }
  await Promise.allSettled(tasks);
}

async function triggerN8n(name: string, payload: unknown): Promise<void> {
  try {
    const { triggerWorkflowByWebhookPath } = await import("@/lib/n8n");
    const { getConfig } = await import("@/lib/ssm-config");
    const cfg = await getConfig();
    const id =
      name === "lead-enrich"
        ? cfg.N8N_WORKFLOW_LEAD_ENRICH_ID
        : name === "newsletter-nurture"
          ? cfg.N8N_WORKFLOW_NEWSLETTER_NURTURE_ID
          : "";
    if (!id) return;
    await triggerWorkflowByWebhookPath(id, payload);
  } catch (err) {
    console.error("[espocrm fanout → n8n] failed:", (err as Error).message);
  }
}

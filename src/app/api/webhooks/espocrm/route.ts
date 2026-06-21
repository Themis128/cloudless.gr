import { NextRequest, NextResponse } from "next/server";
import {
  type EspoEntityRecord,
  type EspoWebhookEnvelope,
  parseEspoEvent,
  verifyEspoWebhookSecret,
} from "@/lib/espocrm-webhook";
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
 * POST /api/webhooks/espocrm — inbound EspoCRM event receiver.
 *
 * Events forwarded to Slack:
 *   Contact.create       → #leads
 *   Lead.create          → #leads
 *   Opportunity.create   → #orders
 *   Opportunity.update   → #orders  (only when `stage` is in the changed
 *                          attributes; otherwise 202 ignored)
 *   Case.create          → #notifications
 *   Case.update          → #notifications (only when `status` changed)
 *   anything else        → 202 Accepted, ignored
 *
 * Auth: EspoCRM Webhook entity doesn't sign payloads — it POSTs raw JSON. We
 * authenticate via a URL-secret query param (`?secret=<hex>`) checked
 * constant-time against ESPOCRM_WEBHOOK_SECRET in SSM. Unset secret = always
 * 401 (never auth-bypass for unconfigured deployments).
 *
 * Smoke-testing: include `{"verification": true}` in the payload to ACK 200
 * without firing any Slack notification.
 */
export async function POST(req: NextRequest) {
  const urlSecret = new URL(req.url).searchParams.get("secret");
  const ok = await verifyEspoWebhookSecret(urlSecret);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();
  let payload: EspoWebhookEnvelope;
  try {
    payload = JSON.parse(rawBody) as EspoWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.verification === true || payload.data?.verification === true) {
    return NextResponse.json({ ok: true, verification: true });
  }

  const records = payload.list ?? (payload.data ? [payload.data] : []);
  if (records.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_records" }, { status: 202 });
  }

  const [entity, action] = parseEspoEvent(payload.event);
  if (!entity || !action) {
    // EspoCRM may POST the entity record itself without the wrapper; we infer
    // the event from the URL path segment if the operator used the convention
    // `?event=Contact.create`. Otherwise, no-op-ack so the receiver stays
    // forward-compatible with payload shapes we don't recognise yet.
    const inferred = new URL(req.url).searchParams.get("event");
    const [e2, a2] = parseEspoEvent(inferred ?? undefined);
    if (!e2 || !a2) {
      return NextResponse.json({ ok: true, skipped: "no_event" }, { status: 202 });
    }
    await dispatch(e2, a2, records);
    return NextResponse.json({ ok: true, dispatched: records.length });
  }

  await dispatch(entity, action, records);
  return NextResponse.json({ ok: true, dispatched: records.length });
}

async function dispatch(
  entity: string,
  action: string,
  records: EspoEntityRecord[]
): Promise<void> {
  // Slack sends in parallel; Promise.allSettled so one failure doesn't drop
  // others. Errors are logged inside SlackClient.
  const tasks: Promise<void>[] = [];
  for (const rec of records ?? []) {
    if (entity === "Contact" && action === "create") tasks.push(notifyContactCreated(rec));
    else if (entity === "Lead" && action === "create") {
      tasks.push(notifyLeadCreated(rec));
      // Lead.create also fans out to the n8n `lead-enrich` workflow (Apollo
      // enrichment + round-robin owner assignment + Slack DM to assignee).
      // The trigger receiver returns 204 No Content if the workflow ID
      // hasn't been set in SSM yet — so a missing N8N_WORKFLOW_LEAD_ENRICH_ID
      // is a silent no-op, not a failure.
      tasks.push(triggerN8n("lead-enrich", { entity, action, record: rec }));
    } else if (entity === "Opportunity" && action === "create")
      tasks.push(notifyOpportunityCreated(rec));
    else if (entity === "Opportunity" && action === "update" && rec.stage)
      tasks.push(notifyOpportunityStageChanged(rec));
    else if (entity === "Case" && action === "create") tasks.push(notifyCaseCreated(rec));
    else if (entity === "Case" && action === "update" && rec.status)
      tasks.push(notifyCaseStatusChanged(rec));
    // unknown <Entity.action> combos are silently ignored — keep the receiver
    // forward-compatible with EspoCRM versions that add new event types.
  }
  await Promise.allSettled(tasks);
}

/** Fire-and-forget n8n trigger by alias. Never throws. Same shape as the
 *  loopback the EspoCRM Slack notifier uses. */
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
    if (!id) return; // operator hasn't created the workflow yet — silent no-op
    await triggerWorkflowByWebhookPath(id, payload);
  } catch (err) {
    console.error("[espocrm webhook → n8n] trigger failed:", (err as Error).message);
  }
}

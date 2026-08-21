/**
 * Shared EspoCRM webhook dispatch logic.
 *
 * Extracted from the two webhook routes that previously duplicated this code
 * verbatim:
 *   - src/app/api/webhooks/espocrm/route.ts      (sync + queue path)
 *   - src/app/api/webhooks/espocrm/fanout/route.ts  (queue consumer path)
 *
 * Adding a new entity/action only requires a change here.
 */
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";
import {
  notifyCaseCreated,
  notifyCaseStatusChanged,
  notifyContactCreated,
  notifyLeadCreated,
  notifyOpportunityCreated,
  notifyOpportunityStageChanged,
} from "@/lib/espocrm-slack";

/**
 * Route one batch of EspoCRM records to the appropriate Slack notifiers and
 * n8n workflow triggers. Runs all tasks in parallel; uses Promise.allSettled
 * so a single failing notifier doesn't drop the rest.
 */
export async function dispatchEspoEvent(
  entity: string,
  action: string,
  records: EspoEntityRecord[]
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const rec of records) {
    if (entity === "Contact" && action === "create") {
      tasks.push(notifyContactCreated(rec));
    } else if (entity === "Lead" && action === "create") {
      tasks.push(notifyLeadCreated(rec));
      // Apollo enrichment + round-robin owner assignment + Slack DM to assignee.
      // Silent no-op when N8N_WORKFLOW_LEAD_ENRICH_ID is not set in SSM.
      tasks.push(triggerN8nWorkflow("lead-enrich", { entity, action, record: rec }));
    } else if (entity === "Opportunity" && action === "create") {
      tasks.push(notifyOpportunityCreated(rec));
    } else if (entity === "Opportunity" && action === "update" && rec.stage) {
      tasks.push(notifyOpportunityStageChanged(rec));
    } else if (entity === "Case" && action === "create") {
      tasks.push(notifyCaseCreated(rec));
    } else if (entity === "Case" && action === "update" && rec.status) {
      tasks.push(notifyCaseStatusChanged(rec));
    }
    // Unknown entity/action combos are intentionally ignored — keeps the
    // receiver forward-compatible with EspoCRM versions that add new event types.
  }
  await Promise.allSettled(tasks);
}

/** Fire-and-forget n8n workflow trigger by workflow alias. Never throws. */
export async function triggerN8nWorkflow(name: string, payload: unknown): Promise<void> {
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
    console.error(`[espocrm-dispatch → n8n] ${name} failed:`, (err as Error).message);
  }
}

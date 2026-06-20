/**
 * EspoCRM webhook payload shapes + URL-secret verification.
 *
 * EspoCRM's free Webhook entity does NOT sign the payload — it POSTs JSON to
 * the configured URL. The only auth available is a shared secret carried in
 * the URL itself (`?secret=<hex>`). We compare it constant-time against
 * `ESPOCRM_WEBHOOK_SECRET` from SSM (see Postiz for the same pattern).
 *
 * Event naming convention: `<Entity>.<event>` — `Contact.create`,
 * `Opportunity.update`, `Case.delete`. The Webhook entity in EspoCRM lets
 * you subscribe to per-entity events; one Webhook can target multiple events.
 */
import { getIntegrationsAsync } from "@/lib/integrations";
import { timingSafeEqual } from "node:crypto";

export interface EspoWebhookEnvelope {
  /**
   * Some EspoCRM versions wrap payloads in `{event, data}`; others POST the
   * raw entity record. We tolerate both — `event` may be undefined when
   * EspoCRM POSTs raw.
   */
  event?: string;
  /** Single-entity payload (older format / `Entity.create`). */
  data?: EspoEntityRecord;
  /** Multi-entity payload (newer format). EspoCRM may batch updates. */
  list?: EspoEntityRecord[];
  /** Smoke-test bypass — when present at any level the handler ACKs but
   *  skips Slack notification and any side-effects. */
  verification?: boolean;
}

export interface EspoEntityRecord {
  id: string;
  /** Display name (already concat'd by EspoCRM for Contact = first + last). */
  name?: string;
  emailAddress?: string;
  phoneNumber?: string;
  stage?: string;
  status?: string;
  amount?: number;
  amountCurrency?: string;
  /** Activity-stream fields when the webhook fires on Note. */
  post?: string;
  parentType?: string;
  parentId?: string;
  parentName?: string;
  createdAt?: string;
  modifiedAt?: string;
  assignedUserName?: string;
  /** Catch-all — EspoCRM custom fields land here untyped. */
  [key: string]: unknown;
}

/**
 * Verify the inbound webhook against the SSM-stored shared secret.
 * Returns true only when the URL `?secret=` matches the configured value
 * AND the configured value is non-empty (an unset secret is never a
 * valid match — never auth-bypass for unconfigured deployments).
 */
export async function verifyEspoWebhookSecret(urlSecret: string | null): Promise<boolean> {
  if (!urlSecret) return false;
  const cfg = await getIntegrationsAsync();
  const expected = cfg.ESPOCRM_WEBHOOK_SECRET;
  if (!expected) return false;
  const a = Buffer.from(urlSecret);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parse the Espo-event name `<Entity>.<event>` into a tuple. Returns
 * `[null, null]` when the event field is absent or malformed — callers should
 * treat this as "ignored event" rather than an error (Espo may add new event
 * shapes; ignoring keeps the receiver forward-compatible).
 */
export function parseEspoEvent(
  event: string | undefined
): [entity: string | null, action: string | null] {
  if (!event) return [null, null];
  const i = event.indexOf(".");
  if (i <= 0 || i === event.length - 1) return [null, null];
  return [event.slice(0, i), event.slice(i + 1)];
}

import type Stripe from "stripe";
import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";

const APP_SOURCE_TAG = "cloudless.gr";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function requireAuthDb(): AuthDatabase {
  const db = getAuthDbFromEnv();
  if (!db) {
    throw new Error("AUTH_DB is not configured");
  }
  return db;
}

function isUniqueConstraintError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT|constraint failed/i.test(msg);
}

export interface StripeEventTags {
  tagSource: string;
  tagStage: string;
  tagCategory: string;
}

export function getStripeEventTags(eventType: string): StripeEventTags {
  const stage = process.env.NEXT_PUBLIC_STAGE || process.env.NODE_ENV || "unknown";
  let tagCategory = "other";

  if (eventType.startsWith("checkout.")) tagCategory = "checkout";
  else if (eventType.startsWith("invoice.")) tagCategory = "invoice";
  else if (eventType.startsWith("customer.subscription.")) tagCategory = "subscription";

  return {
    tagSource: APP_SOURCE_TAG,
    tagStage: stage,
    tagCategory,
  };
}

function toEventDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function extractObjectFields(event: Stripe.Event) {
  const object = event.data.object as unknown as Record<string, unknown>;
  return {
    object,
    amountMinor:
      asNumber(object.amount_total) ?? asNumber(object.amount_due) ?? asNumber(object.amount_paid),
    objectId: asString(object.id),
    currency: asString(object.currency),
    paymentStatus: asString(object.payment_status) ?? asString(object.status),
    customerId: asString(object.customer),
    customerEmail: asString(object.customer_email),
    mode: asString(object.mode),
  };
}

export interface PersistStripeEventResult {
  duplicate: boolean;
}

async function persistStripeEventD1(
  db: AuthDatabase,
  event: Stripe.Event
): Promise<PersistStripeEventResult> {
  const { customerId, amountMinor, currency } = extractObjectFields(event);
  const tags = getStripeEventTags(event.type);
  const eventDay = toEventDay(event.created);
  const stageCategory = `${tags.tagStage}#${tags.tagCategory}`;
  const receivedAt = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO stripe_transaction (
          event_id, event_type, tag_category, tag_stage, stage_category,
          event_day, customer_id, processing_status, received_at,
          amount_minor, currency, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.type,
        tags.tagCategory,
        tags.tagStage,
        stageCategory,
        eventDay,
        customerId ?? null,
        "received",
        receivedAt,
        typeof amountMinor === "number" ? amountMinor : null,
        currency ?? null,
        toJson(event.data.object)
      )
      .run();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { duplicate: true };
    }
    throw error;
  }

  sinkStripeEventToLake(event).catch(() => {});
  return { duplicate: false };
}

/**
 * Persist a Stripe webhook event for idempotency (D1 `stripe_transaction`).
 */
export async function persistStripeEvent(event: Stripe.Event): Promise<PersistStripeEventResult> {
  return persistStripeEventD1(requireAuthDb(), event);
}

async function markStripeEventD1(
  db: AuthDatabase,
  eventId: string,
  status: "processed" | "handler_failed",
  errorMessage?: string
): Promise<void> {
  const processedAt = Date.now();
  if (status === "processed") {
    await db
      .prepare(
        `UPDATE stripe_transaction
         SET processing_status = ?, processed_at = ?, processing_error = NULL
         WHERE event_id = ?`
      )
      .bind(status, processedAt, eventId)
      .run();
    return;
  }

  await db
    .prepare(
      `UPDATE stripe_transaction
       SET processing_status = ?, processed_at = ?, processing_error = ?
       WHERE event_id = ?`
    )
    .bind(status, processedAt, (errorMessage ?? "").slice(0, 1000), eventId)
    .run();
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await markStripeEventD1(requireAuthDb(), eventId, "processed");
}

export async function markStripeEventFailed(eventId: string, errorMessage: string): Promise<void> {
  await markStripeEventD1(requireAuthDb(), eventId, "handler_failed", errorMessage);
}

// ---------------------------------------------------------------------------
// Data Lake sink — writes Stripe events to R2 (Cloudflare DATALAKE_BUCKET).
// ---------------------------------------------------------------------------

async function sinkStripeEventToLake(event: Stripe.Event): Promise<void> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) {
    console.warn("[stripe-transactions] DATALAKE_BUCKET not bound — lake sink skipped");
    return;
  }

  const d = new Date(event.created * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const key = `events/year=${year}/month=${month}/day=${day}/stripe_${event.id}.ndjson`;

  const obj = event.data.object as unknown as Record<string, unknown>;
  const record = JSON.stringify({
    timestamp: d.toISOString(),
    event: event.type,
    user_id: (obj.customer as string) ?? undefined,
    email:
      (obj.customer_email as string) ??
      ((obj.customer_details as Record<string, unknown>)?.email as string) ??
      undefined,
    amount: (obj.amount_total as number) ?? undefined,
    currency: (obj.currency as string) ?? undefined,
    product_id: event.type,
    source: "stripe_webhook",
    properties: { stripe_event_id: event.id, type: event.type },
  });

  await bucket.put(key, record, {
    httpMetadata: { contentType: "application/x-ndjson" },
  });
}

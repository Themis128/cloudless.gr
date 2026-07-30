import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";

/**
 * Stripe revenue / event analytics snapshot.
 *
 * D1 `stripe_transaction` via AUTH_DB. Throws when AUTH_DB is unbound.
 */

function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayRange(days: number): string[] {
  const range: string[] = [];
  const now = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    range.push(toDayString(date));
  }
  return range;
}

interface AnalyticsRow {
  eventDay?: string;
  stripeCreatedAt?: number;
  receivedAt?: number;
  tagCategory?: string;
  processingStatus?: string;
  currency?: string;
  amountMinor?: number;
}

function deriveDay(row: AnalyticsRow): string | undefined {
  if (row.eventDay) return row.eventDay;

  if (typeof row.stripeCreatedAt === "number") {
    return toDayString(new Date(row.stripeCreatedAt * 1000));
  }

  if (typeof row.receivedAt === "number") {
    return toDayString(new Date(row.receivedAt));
  }

  return undefined;
}

export interface DailyAnalyticsPoint {
  day: string;
  revenueMinor: number;
  events: number;
  processed: number;
  failed: number;
}

export interface StripeAnalyticsSnapshot {
  windowDays: number;
  generatedAt: string;
  totals: {
    events: number;
    revenueMinor: number;
    processed: number;
    failed: number;
  };
  byCategory: Record<string, { events: number; revenueMinor: number }>;
  byStatus: Record<string, number>;
  byCurrency: Record<string, number>;
  dailyTrend: DailyAnalyticsPoint[];
}

function emptySnapshot(days: number): StripeAnalyticsSnapshot {
  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    totals: {
      events: 0,
      revenueMinor: 0,
      processed: 0,
      failed: 0,
    },
    byCategory: {},
    byStatus: {},
    byCurrency: {},
    dailyTrend: getDayRange(days).map((day) => ({
      day,
      revenueMinor: 0,
      events: 0,
      processed: 0,
      failed: 0,
    })),
  };
}

function applyRow(snapshot: StripeAnalyticsSnapshot, row: AnalyticsRow): void {
  const day = deriveDay(row);
  const category = row.tagCategory || "other";
  const status = row.processingStatus || "unknown";
  const currency = row.currency || "unknown";
  const amountMinor = row.amountMinor || 0;

  snapshot.totals.events += 1;
  snapshot.totals.revenueMinor += amountMinor;

  if (status === "processed") snapshot.totals.processed += 1;
  if (status === "handler_failed") snapshot.totals.failed += 1;

  if (!snapshot.byCategory[category]) {
    snapshot.byCategory[category] = { events: 0, revenueMinor: 0 };
  }
  snapshot.byCategory[category].events += 1;
  snapshot.byCategory[category].revenueMinor += amountMinor;

  snapshot.byStatus[status] = (snapshot.byStatus[status] || 0) + 1;
  snapshot.byCurrency[currency] = (snapshot.byCurrency[currency] || 0) + amountMinor;

  if (!day) return;
  const point = snapshot.dailyTrend.find((entry) => entry.day === day);
  if (!point) return;

  point.events += 1;
  point.revenueMinor += amountMinor;
  if (status === "processed") point.processed += 1;
  if (status === "handler_failed") point.failed += 1;
}

function amountFromPayload(payloadJson: string | null | undefined): number | undefined {
  if (!payloadJson) return undefined;
  try {
    const object = JSON.parse(payloadJson) as Record<string, unknown>;
    const candidates = [object.amount_total, object.amount_due, object.amount_paid];
    for (const value of candidates) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  } catch {
    /* ignore malformed payloads */
  }
  return undefined;
}

function currencyFromPayload(payloadJson: string | null | undefined): string | undefined {
  if (!payloadJson) return undefined;
  try {
    const object = JSON.parse(payloadJson) as Record<string, unknown>;
    return typeof object.currency === "string" ? object.currency : undefined;
  } catch {
    return undefined;
  }
}

interface D1StripeRow {
  event_day: string | null;
  tag_category: string | null;
  processing_status: string | null;
  currency: string | null;
  amount_minor: number | null;
  received_at: number | null;
  payload_json: string | null;
}

function d1RowToAnalytics(row: D1StripeRow): AnalyticsRow {
  const amountMinor =
    typeof row.amount_minor === "number" && Number.isFinite(row.amount_minor)
      ? row.amount_minor
      : amountFromPayload(row.payload_json);
  const currency = row.currency || currencyFromPayload(row.payload_json);
  return {
    eventDay: row.event_day ?? undefined,
    receivedAt: typeof row.received_at === "number" ? row.received_at : undefined,
    tagCategory: row.tag_category ?? undefined,
    processingStatus: row.processing_status ?? undefined,
    currency: currency ?? undefined,
    amountMinor,
  };
}

async function queryD1Rows(db: AuthDatabase, days: number): Promise<AnalyticsRow[]> {
  const dayRange = getDayRange(days);
  const startDay = dayRange[0];
  const endDay = dayRange[dayRange.length - 1];

  const result = await db
    .prepare(
      `SELECT event_day, tag_category, processing_status, currency, amount_minor,
              received_at, payload_json
       FROM stripe_transaction
       WHERE event_day >= ? AND event_day <= ?`
    )
    .bind(startDay, endDay)
    .all<D1StripeRow>();

  return (result.results ?? []).map(d1RowToAnalytics);
}

export async function getStripeAnalyticsSnapshot(
  inputDays: number = 30
): Promise<StripeAnalyticsSnapshot> {
  const days = Math.max(1, Math.min(365, Math.trunc(inputDays)));
  const snapshot = emptySnapshot(days);

  const db = getAuthDbFromEnv();
  if (!db) {
    throw new Error("AUTH_DB is not configured");
  }

  const rows = await queryD1Rows(db, days);
  for (const row of rows) {
    applyRow(snapshot, row);
  }

  return snapshot;
}

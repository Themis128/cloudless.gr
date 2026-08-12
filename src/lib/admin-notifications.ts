import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";
import { APP_TIMEZONE } from "@/lib/timezone";

/**
 * Durable admin notifications store.
 *
 * D1 `admin_notification` via AUTH_DB. Reads return [] when AUTH_DB is
 * unbound. Side-effect appends (`recordNotification`) soft-fail; explicit
 * admin mutations throw when AUTH_DB is missing. Lake sink (R2) still runs
 * on record regardless.
 *
 * Categories: contact | subscribe | booking | order | error | auth | portal
 */

export type NotificationCategory =
  "contact" | "subscribe" | "booking" | "order" | "error" | "auth" | "portal";

export type NotificationType = "info" | "warning" | "error" | "success";

export interface AdminNotification {
  id: string;
  createdAt: string; // ISO 8601
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  /** Optional actor (email / user id / system). */
  actor?: string;
  /** Optional route that fired the notification. */
  route?: string;
  /** Free-form structured payload for analytics. */
  metadata?: Record<string, unknown>;
  read: boolean;
  /** Set by the archive cron when the row is exported to the lake. */
  archivedAt?: string;
}

const PK_ALL = "NOTIF";

function randomId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSk(createdAt: string, id: string): string {
  return `${createdAt}#${id}`;
}

function requireAuthDb(): AuthDatabase {
  const db = getAuthDbFromEnv();
  if (!db) {
    throw new Error("AUTH_DB is not configured");
  }
  return db;
}

interface D1NotificationRow {
  pk: string;
  sk: string;
  category: string;
  id: string | null;
  type: string | null;
  title: string | null;
  message: string | null;
  actor: string | null;
  route: string | null;
  read: number | null;
  archived_at: string | null;
  payload_json: string | null;
  created_at: number | null;
}

function fromD1Row(row: D1NotificationRow): AdminNotification {
  let metadata: Record<string, unknown> | undefined;
  if (row.payload_json) {
    try {
      metadata = JSON.parse(row.payload_json) as Record<string, unknown>;
    } catch {
      // drop
    }
  }
  const createdAt =
    row.sk?.includes("#") && row.sk.split("#")[0]
      ? row.sk.split("#")[0]
      : row.created_at
        ? new Date(row.created_at * 1000).toISOString()
        : "";
  return {
    id: row.id ?? (row.sk.includes("#") ? row.sk.slice(row.sk.indexOf("#") + 1) : ""),
    createdAt,
    category: (row.category ?? "error") as NotificationCategory,
    type: (row.type ?? "info") as NotificationType,
    title: row.title ?? "",
    message: row.message ?? "",
    actor: row.actor ?? undefined,
    route: row.route ?? undefined,
    metadata,
    read: Boolean(row.read),
    archivedAt: row.archived_at ?? undefined,
  };
}

async function recordNotificationD1(
  db: AuthDatabase,
  notif: AdminNotification
): Promise<AdminNotification | null> {
  const sk = buildSk(notif.createdAt, notif.id);
  const createdAtUnix = Math.floor(new Date(notif.createdAt).getTime() / 1000);
  try {
    await db
      .prepare(
        `INSERT INTO admin_notification (
          pk, sk, category, id, type, title, message, actor, route,
          read, archived_at, cat_pk, cat_sk, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        PK_ALL,
        sk,
        notif.category,
        notif.id,
        notif.type,
        notif.title,
        notif.message,
        notif.actor ?? null,
        notif.route ?? null,
        notif.read ? 1 : 0,
        notif.archivedAt ?? null,
        `CAT#${notif.category}`,
        sk,
        notif.metadata ? JSON.stringify(notif.metadata) : null,
        createdAtUnix
      )
      .run();
    return notif;
  } catch (err) {
    console.warn(
      "[admin-notifications] D1 recordNotification failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function listNotificationsD1(
  db: AuthDatabase,
  filters: ListFilters
): Promise<AdminNotification[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filters.category) {
    clauses.push("category = ?");
    binds.push(filters.category);
  } else {
    clauses.push("pk = ?");
    binds.push(PK_ALL);
  }

  if (filters.since) {
    clauses.push("sk >= ?");
    binds.push(`${filters.since}#`);
  }
  if (filters.until) {
    clauses.push("sk < ?");
    binds.push(`${filters.until}~`);
  }
  if (!filters.includeArchived) {
    clauses.push("(archived_at IS NULL OR archived_at = '')");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT pk, sk, category, id, type, title, message, actor, route,
                      read, archived_at, payload_json, created_at
               FROM admin_notification
               ${where}
               ORDER BY sk DESC
               LIMIT ?`;
  binds.push(limit);

  const result = await db
    .prepare(sql)
    .bind(...binds)
    .all<D1NotificationRow>();
  return (result.results ?? []).map(fromD1Row);
}

async function markNotificationsReadD1(db: AuthDatabase, ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.prepare(`UPDATE admin_notification SET read = 1 WHERE id = ?`).bind(id).run();
  }
}

async function purgeArchivedOlderThanD1(db: AuthDatabase, olderThan: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM admin_notification
       WHERE archived_at IS NOT NULL AND archived_at <> '' AND archived_at < ?`
    )
    .bind(olderThan)
    .run();
  return result.meta?.changes ?? 0;
}

/**
 * Append a notification (side-effect for contact/order/auth producers).
 * Soft-fails when AUTH_DB is unbound or D1 insert fails — returns null so
 * fire-and-forget callers (Stripe webhook, contact, subscribe) never reject
 * the primary request path. Explicit admin mutations still fail closed.
 */
export async function recordNotification(input: {
  category: NotificationCategory;
  type?: NotificationType;
  title: string;
  message: string;
  actor?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}): Promise<AdminNotification | null> {
  const notif: AdminNotification = {
    id: randomId(),
    createdAt: new Date().toISOString(),
    category: input.category,
    type: input.type ?? "info",
    title: input.title,
    message: input.message,
    actor: input.actor,
    route: input.route,
    metadata: input.metadata,
    read: false,
  };

  // Always write to data lake (R2) for analytics — fire and forget.
  sinkToLake(notif).catch(() => {});

  const db = getAuthDbFromEnv();
  if (!db) return null;
  return recordNotificationD1(db, notif);
}

export interface ListFilters {
  category?: NotificationCategory;
  since?: string;
  until?: string;
  limit?: number;
  includeArchived?: boolean;
  includeRead?: boolean;
}

/**
 * Read recent notifications, newest first. Defaults to 50 most recent
 * un-archived entries. Returns [] when AUTH_DB is unbound.
 */
export async function listNotifications(filters: ListFilters = {}): Promise<AdminNotification[]> {
  const db = getAuthDbFromEnv();
  if (!db) return [];
  return listNotificationsD1(db, filters);
}

/**
 * Mark a set of notifications as read.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await markNotificationsReadD1(requireAuthDb(), ids);
}

/**
 * Per-category counts over a window. Used by the admin analytics endpoint.
 */
export async function notificationAnalytics(
  opts: {
    since: string;
    until?: string;
  } = { since: "" }
): Promise<{
  total: number;
  byCategory: Record<NotificationCategory, number>;
  byDay: Record<string, number>;
}> {
  const byCategory: Record<NotificationCategory, number> = {
    contact: 0,
    subscribe: 0,
    booking: 0,
    order: 0,
    error: 0,
    auth: 0,
    portal: 0,
  };
  const byDay: Record<string, number> = {};
  let total = 0;
  const items = await listNotifications({
    since: opts.since,
    until: opts.until,
    limit: 200,
    includeArchived: true,
  });
  for (const n of items) {
    total++;
    byCategory[n.category]++;
    const day = n.createdAt.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  return { total, byCategory, byDay };
}

/**
 * Hard-delete archived rows older than `olderThan` (ISO 8601 cutoff).
 */
export async function purgeArchivedOlderThan(olderThan: string): Promise<number> {
  return purgeArchivedOlderThanD1(requireAuthDb(), olderThan);
}

// ---------------------------------------------------------------------------
// Data Lake sink — writes notifications to R2 (DATALAKE_BUCKET).
// ---------------------------------------------------------------------------

async function sinkToLake(notif: AdminNotification): Promise<void> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) {
    console.warn("[admin-notifications] DATALAKE_BUCKET not bound — lake sink skipped");
    return;
  }

  const d = new Date(notif.createdAt);
  const athensDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  const [year, month] = athensDay.split("-");
  const key = `lake/notifications/year=${year}/month=${month}/${notif.id}.json`;

  const record = JSON.stringify({
    id: notif.id,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    email: notif.actor,
    channel: "system",
    created_at: notif.createdAt,
    metadata: notif.metadata ? JSON.stringify(notif.metadata) : null,
  });

  await bucket.put(key, record, {
    httpMetadata: { contentType: "application/json" },
  });
}

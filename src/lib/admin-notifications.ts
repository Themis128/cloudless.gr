import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";

/**
 * Durable admin notifications store.
 *
 * Cloudflare-first: prefer D1 `admin_notification` when AUTH_DB is bound.
 * Legacy fallback: DynamoDB `ADMIN_NOTIFICATIONS_TABLE`.
 *
 * Dynamo schema (legacy):
 *   - pk = "NOTIF"
 *   - sk = "<createdAt-ISO8601>#<id>"
 *   - GSI categoryIndex: pk = "CAT#<category>", sk = "<createdAt-ISO8601>#<id>"
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

const REGION = process.env.AWS_REGION || "us-east-1";

let dynamoClient: DynamoDBClient | null = null;
function getDynamoClient(): DynamoDBClient {
  dynamoClient ??= new DynamoDBClient({
    region: REGION,
    endpoint: resolveDynamoEndpoint(),
  });
  return dynamoClient;
}

function getTableName(): string {
  const name = process.env.ADMIN_NOTIFICATIONS_TABLE?.trim();
  if (!name) throw new Error("ADMIN_NOTIFICATIONS_TABLE is not configured");
  return name;
}

const PK_ALL = "NOTIF";
const CAT_INDEX = "categoryIndex";

function randomId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSk(createdAt: string, id: string): string {
  return `${createdAt}#${id}`;
}

function toItem(notif: AdminNotification): Record<string, AttributeValue> {
  const item: Record<string, AttributeValue> = {
    pk: { S: PK_ALL },
    sk: { S: buildSk(notif.createdAt, notif.id) },
    catPk: { S: `CAT#${notif.category}` },
    catSk: { S: buildSk(notif.createdAt, notif.id) },
    id: { S: notif.id },
    createdAt: { S: notif.createdAt },
    category: { S: notif.category },
    type: { S: notif.type },
    title: { S: notif.title },
    message: { S: notif.message },
    read: { BOOL: notif.read },
  };
  if (notif.actor) item.actor = { S: notif.actor };
  if (notif.route) item.route = { S: notif.route };
  if (notif.metadata) item.metadata = { S: JSON.stringify(notif.metadata) };
  if (notif.archivedAt) item.archivedAt = { S: notif.archivedAt };
  return item;
}

function fromItem(item: Record<string, AttributeValue>): AdminNotification {
  let metadata: Record<string, unknown> | undefined;
  const rawMeta = item.metadata?.S;
  if (rawMeta) {
    try {
      metadata = JSON.parse(rawMeta) as Record<string, unknown>;
    } catch {
      // Malformed JSON — drop silently to keep the list useful.
    }
  }
  return {
    id: item.id?.S ?? "",
    createdAt: item.createdAt?.S ?? "",
    category: (item.category?.S ?? "error") as NotificationCategory,
    type: (item.type?.S ?? "info") as NotificationType,
    title: item.title?.S ?? "",
    message: item.message?.S ?? "",
    actor: item.actor?.S,
    route: item.route?.S,
    metadata,
    read: item.read?.BOOL ?? false,
    archivedAt: item.archivedAt?.S,
  };
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
 * Append a notification. Failures are returned (not thrown) so producer paths
 * can keep serving the user-facing response. Callers should log but not abort.
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
  if (db) {
    return recordNotificationD1(db, notif);
  }

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    // No D1 / Dynamo — lake-only mode.
    return notif;
  }
  try {
    await getDynamoClient().send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: toItem(notif),
      })
    );
    return notif;
  } catch (err) {
    console.warn(
      "[admin-notifications] recordNotification failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
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
 * un-archived entries.
 */
export async function listNotifications(filters: ListFilters = {}): Promise<AdminNotification[]> {
  const db = getAuthDbFromEnv();
  if (db) {
    return listNotificationsD1(db, filters);
  }

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    return [];
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const useCategoryIndex = Boolean(filters.category);

  const keyConditionParts: string[] = [];
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, AttributeValue> = {};

  if (useCategoryIndex) {
    keyConditionParts.push("#cpk = :cpk");
    exprNames["#cpk"] = "catPk";
    exprValues[":cpk"] = { S: `CAT#${filters.category}` };
  } else {
    keyConditionParts.push("#pk = :pk");
    exprNames["#pk"] = "pk";
    exprValues[":pk"] = { S: PK_ALL };
  }

  if (filters.since && filters.until) {
    keyConditionParts.push("#sk BETWEEN :since AND :until");
    exprNames["#sk"] = useCategoryIndex ? "catSk" : "sk";
    exprValues[":since"] = { S: `${filters.since}#` };
    exprValues[":until"] = { S: `${filters.until}~` };
  } else if (filters.since) {
    keyConditionParts.push("#sk >= :since");
    exprNames["#sk"] = useCategoryIndex ? "catSk" : "sk";
    exprValues[":since"] = { S: `${filters.since}#` };
  }

  const filterExpressions: string[] = [];
  if (!filters.includeArchived) {
    filterExpressions.push("attribute_not_exists(#archivedAt)");
    exprNames["#archivedAt"] = "archivedAt";
  }

  const out = await getDynamoClient().send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: useCategoryIndex ? CAT_INDEX : undefined,
      KeyConditionExpression: keyConditionParts.join(" AND "),
      ...(filterExpressions.length ? { FilterExpression: filterExpressions.join(" AND ") } : {}),
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      Limit: limit,
      ScanIndexForward: false,
    })
  );

  return (out.Items ?? []).map(fromItem);
}

/**
 * Mark a set of notifications as read.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;

  const db = getAuthDbFromEnv();
  if (db) {
    await markNotificationsReadD1(db, ids);
    return;
  }

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) return;

  for (const id of ids) {
    const matches = await getDynamoClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: "#pk = :pk",
        FilterExpression: "#id = :id",
        ExpressionAttributeNames: { "#pk": "pk", "#id": "id" },
        ExpressionAttributeValues: {
          ":pk": { S: PK_ALL },
          ":id": { S: id },
        },
        Limit: 1,
      })
    );
    const item = matches.Items?.[0];
    if (!item) continue;
    await getDynamoClient().send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: "SET #read = :true",
        ExpressionAttributeNames: { "#read": "read" },
        ExpressionAttributeValues: { ":true": { BOOL: true } },
      })
    );
  }
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
  const db = getAuthDbFromEnv();
  if (db) {
    return purgeArchivedOlderThanD1(db, olderThan);
  }

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) return 0;

  let purged = 0;
  let lastKey: Record<string, AttributeValue> | undefined;
  do {
    const page: QueryCommand = new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "#pk = :pk AND #sk < :until",
      FilterExpression: "attribute_exists(#archivedAt) AND #archivedAt < :until",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
        "#archivedAt": "archivedAt",
      },
      ExpressionAttributeValues: {
        ":pk": { S: PK_ALL },
        ":until": { S: `${olderThan}~` },
      },
      ExclusiveStartKey: lastKey,
      Limit: 25,
    });
    const res = await getDynamoClient().send(page);
    const items = res.Items ?? [];
    if (items.length) {
      await getDynamoClient().send(
        new BatchWriteItemCommand({
          RequestItems: {
            [getTableName()]: items.map((it) => ({
              DeleteRequest: { Key: { pk: it.pk, sk: it.sk } },
            })),
          },
        })
      );
      purged += items.length;
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return purged;
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
  const year = String(d.getUTCFullYear());
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
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

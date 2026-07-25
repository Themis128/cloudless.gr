import type { AttributeValue } ;
import type { AuthDatabase } from "@/lib/auth-d1";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

/**
 * Durable admin notifications store — D1 primary (Cloudflare Workers) +
 * DynamoDB fallback (AWS Lambda).
 *
 * D1 Schema (admin_notification table):
 *   pk = "NOTIF"
 *   sk = "<createdAt-ISO8601>#<id>"
 *   category = "<category>"
 *   payload_json = JSON.stringify({ id, type, title, message, actor, route, metadata, read, archivedAt })
 *   created_at = epoch seconds
 *
 * DynamoDB Schema (legacy fallback):
 *   - pk = "NOTIF"  (single partition — small scale, simpler queries)
 *   - sk = "<createdAt-ISO8601>#<id>"  (sortable, unique)
 *   - GSI categoryIndex: pk = "CAT#<category>", sk = "<createdAt-ISO8601>#<id>"
 *
 * Categories:
 *   contact   — contact form submission
 *   subscribe — newsletter sign-up
 *   booking   — calendar booking
 *   order     — Stripe paid checkout
 *   error     — application exception
 *   auth      — sign-up / sign-in / password reset
 *   portal    — client-portal action
 *
 * Retention policy: 90 days hot in D1/Dynamo. After 90 days, the daily archive
 * cron job sets `archivedAt` and exports the row to R2/S3. Rows with
 * `archivedAt` set are excluded from the admin UI by default.
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
  /** Set by the archive cron when the row is exported to S3. */
  archivedAt?: string;
}

const REGION = process.env.AWS_REGION || "us-east-1";

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

let dynamoClient: any = null;
async function getDynamoClient() {
  if (!dynamoClient) {
      region: REGION,
      endpoint: resolveDynamoEndpoint(),
    });
  }
  return dynamoClient;
}

function getTableName(): string | null {
  return process.env.ADMIN_NOTIFICATIONS_TABLE?.trim() || null;
}

const PK_ALL = "NOTIF";
const CAT_INDEX = "categoryIndex";

function randomId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSk(createdAt: string, id: string): string {
  return `${createdAt}#${id}`;
}

function buildPayload(notif: AdminNotification): string {
  return JSON.stringify({
    id: notif.id,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    actor: notif.actor,
    route: notif.route,
    metadata: notif.metadata,
    read: notif.read,
    archivedAt: notif.archivedAt,
  });
}

function parsePayload(row: Record<string, unknown>): AdminNotification {
  const payload = JSON.parse((row.payload_json as string) || "{}") as {
    id?: string;
    type?: NotificationType;
    title?: string;
    message?: string;
    actor?: string;
    route?: string;
    metadata?: Record<string, unknown>;
    read?: boolean;
    archivedAt?: string;
  };
  const createdAt = row.sk
    ? (String(row.sk).split("#")[0] ?? new Date((row.created_at as number) * 1000).toISOString())
    : new Date((row.created_at as number) * 1000).toISOString();
  return {
    id: payload.id ?? String(row.sk).split("#")[1] ?? "",
    createdAt,
    category: (row.category as NotificationCategory) ?? "error",
    type: payload.type ?? "info",
    title: payload.title ?? "",
    message: payload.message ?? "",
    actor: payload.actor,
    route: payload.route,
    metadata: payload.metadata,
    read: payload.read ?? false,
    archivedAt: payload.archivedAt,
  };
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

/**
 * Append a notification. Failures are returned (not thrown) so producer paths
 * can keep serving the user-facing response. Callers should log but not abort.
 *
 * D1 primary; DynamoDB fallback.
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

  // Always write to data lake (R2/S3) for analytics — fire and forget.
  sinkToLake(notif).catch(() => {});

  const db = getAuthDb();
  if (db) {
    try {
      const sk = buildSk(notif.createdAt, notif.id);
      await db
        .prepare(
          "INSERT INTO admin_notification (pk, sk, category, payload_json, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(PK_ALL, sk, notif.category, buildPayload(notif), Math.floor(Date.now() / 1000))
        .run();
      return notif;
    } catch (err) {
      console.warn(
        "[admin-notifications] D1 recordNotification failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const table = getTableName();
  if (!table) return notif; // lake-only mode
  try {
    const c = await getDynamoClient();
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: toItem(notif),
      })
    );
    return notif;
  } catch (err) {
    console.warn(
      "[admin-notifications] DynamoDB recordNotification failed:",
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
 * Read recent notifications from D1 or DynamoDB, newest first.
 * Defaults to 50 most recent un-archived entries.
 */
export async function listNotifications(filters: ListFilters = {}): Promise<AdminNotification[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      let sql =
        "SELECT pk, sk, category, payload_json, created_at FROM admin_notification WHERE pk = ?";
      const binds: (string | number)[] = [PK_ALL];
      if (filters.category) {
        sql += " AND category = ?";
        binds.push(filters.category);
      }
      if (filters.since) {
        sql += " AND sk >= ?";
        binds.push(`${filters.since}#`);
      }
      if (filters.until) {
        sql += " AND sk <= ?";
        binds.push(`${filters.until}~`);
      }
      if (!filters.includeArchived) {
        // In D1 we store archivedAt inside payload_json; skip filtering for now
        // (complex JSON filter in SQLite is expensive; rely on app-level filter)
      }
      sql += " ORDER BY sk DESC LIMIT ?";
      binds.push(limit);

      const result = await db
        .prepare(sql)
        .bind(...binds)
        .all<{
          pk: string;
          sk: string;
          category: string;
          payload_json: string;
          created_at: number;
        }>();
      const rows = result.results ?? [];
      let items = rows.map((row) => parsePayload(row));
      if (!filters.includeArchived) {
        items = items.filter((n) => !n.archivedAt);
      }
      return items;
    } catch (err) {
      console.warn(
        "[admin-notifications] D1 listNotifications failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const table = getTableName() ?? undefined;
  if (!table) return [];

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

  const c = await getDynamoClient();
  const out = await c.send(
    new QueryCommand({
      TableName: table,
      IndexName: useCategoryIndex ? CAT_INDEX : undefined,
      KeyConditionExpression: keyConditionParts.join(" AND "),
      ...(filterExpressions.length ? { FilterExpression: filterExpressions.join(" AND ") } : {}),
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      Limit: limit,
      ScanIndexForward: false, // newest first
    })
  );

  return (out.Items ?? []).map(fromItem);
}

/**
 * Mark a set of notifications as read.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;

  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      for (const id of ids) {
        // Find the row by extracting id from payload_json and update it
        const row = await db
          .prepare(
            "SELECT sk FROM admin_notification WHERE pk = ? AND json_extract(payload_json, '$.id') = ? LIMIT 1"
          )
          .bind(PK_ALL, id)
          .first<{ sk: string }>();
        if (!row) continue;
        await db
          .prepare(
            "UPDATE admin_notification SET payload_json = json_set(payload_json, '$.read', true) WHERE pk = ? AND sk = ?"
          )
          .bind(PK_ALL, row.sk)
          .run();
      }
      return;
    } catch (err) {
      console.warn(
        "[admin-notifications] D1 markNotificationsRead failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const table = getTableName();
  if (!table) return;
  // We can't UpdateItem without the full sort key, so fetch + update.
  // For small batches this is fine. (Optimization: store an idIndex GSI.)
  for (const id of ids) {
    const c = await getDynamoClient();
    const matches = await c.send(
      new QueryCommand({
        TableName: table,
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
    const client2 = await getDynamoClient();
    await client2.send(
      new UpdateItemCommand({
        TableName: table,
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
 * Returns { total, byCategory: { contact: N, ... }, byDay: { '2026-06-12': N, ... } }.
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
 * Called by the archive cron AFTER successful S3 export + grace window.
 * Returns the number of rows deleted.
 */
export async function purgeArchivedOlderThan(olderThan: string): Promise<number> {
  const table = getTableName() ?? undefined;
  if (!table) return 0;

  let purged = 0;
  // Walk in batches of 25 (BatchWriteItem max).
  let lastKey: Record<string, AttributeValue> | undefined;
  do {
     const c = await getDynamoClient();
     const page = new QueryCommand({
       TableName: table,
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
     const res = await c.send(page);
    const items = res.Items ?? [];
    if (items.length) {
      const c = await getDynamoClient();
      await c.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [table]: items.map((item: any) => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
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
// Data Lake sink — writes notifications to R2 (primary) or S3 (fallback).
// Partitioned by year/month for the notifications table schema.
// ---------------------------------------------------------------------------

interface R2Env {
  DATALAKE_BUCKET: R2Bucket;
}

function getLakeR2(): R2Bucket | null {
  return (process.env as unknown as R2Env).DATALAKE_BUCKET ?? null;
}

const LAKE_BUCKET = process.env.ANALYTICS_S3_BUCKET || "cloudless-analytics-data";

  return s3Client;
}

async function sinkToLake(notif: AdminNotification): Promise<void> {
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

  // Try R2 first (Cloudflare Workers)
  const r2 = getLakeR2();
  if (r2) {
    try {
      await r2.put(key, record, { customMetadata: { contentType: "application/json" } });
      return;
    } catch (err) {
      console.warn(
        "[admin-notifications] R2 sink failed, falling back to S3:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await getS3().send(
    new PutObjectCommand({
      Bucket: LAKE_BUCKET,
      Key: key,
      Body: record,
      ContentType: "application/json",
    })
  );
}

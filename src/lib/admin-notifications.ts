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

/**
 * Durable admin notifications store on DynamoDB.
 *
 * Schema:
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
 * Retention policy: 90 days hot in Dynamo. After 90 days, the daily archive
 * cron job sets `archivedAt` and exports the row to R2 datalake. Rows with
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

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    // DynamoDB table not configured — lake-only mode.
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

  // Range condition on the sort key (which encodes createdAt).
  if (filters.since && filters.until) {
    keyConditionParts.push("#sk BETWEEN :since AND :until");
    exprNames["#sk"] = useCategoryIndex ? "catSk" : "sk";
    exprValues[":since"] = { S: `${filters.since}#` };
    // End-of-range trick: append "~" so we capture every id with the
    // until timestamp prefix.
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
  if (!filters.includeRead) {
    // Keep this opt-in too — by default the UI shows everything.
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
      ScanIndexForward: false, // newest first
    })
  );

  return (out.Items ?? []).map(fromItem);
}

/**
 * Mark a set of notifications as read.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length || !process.env.ADMIN_NOTIFICATIONS_TABLE) return;
  // We can't UpdateItem without the full sort key, so fetch + update.
  // For small batches this is fine. (Optimization: store an idIndex GSI.)
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
  let purged = 0;
  // Walk in batches of 25 (BatchWriteItem max).
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
// Partitioned by year/month for the notifications table schema.
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

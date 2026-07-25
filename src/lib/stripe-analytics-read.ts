import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

const REGION = process.env.AWS_REGION || "us-east-1";

let dynamoClient: any = null;

async function getDynamoClient() {
  if (!dynamoClient) {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    dynamoClient = new DynamoDBClient({
      region: REGION,
      endpoint: resolveDynamoEndpoint(),
    });
  }
  return dynamoClient;
}

function getTransactionsTableName(): string {
  const tableName = process.env.STRIPE_TRANSACTIONS_TABLE?.trim();
  if (tableName) return tableName;
  throw new Error("STRIPE_TRANSACTIONS_TABLE is not configured");
}

function attrToString(value?: AttributeValue): string | undefined {
  if (!value) return undefined;
  if ("S" in value) return value.S;
  return undefined;
}

function attrToNumber(value?: AttributeValue): number | undefined {
  if (!value) return undefined;
  if ("N" in value) {
    const numberValue = Number(value.N);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
  return undefined;
}

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

function deriveDay(item: Record<string, AttributeValue>): string | undefined {
  const explicitDay = attrToString(item.eventDay);
  if (explicitDay) return explicitDay;

  const stripeCreatedAt = attrToNumber(item.stripeCreatedAt);
  if (typeof stripeCreatedAt === "number") {
    return toDayString(new Date(stripeCreatedAt * 1000));
  }

  const receivedAt = attrToNumber(item.receivedAt);
  if (typeof receivedAt === "number") {
    return toDayString(new Date(receivedAt));
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

function applyItem(snapshot: StripeAnalyticsSnapshot, item: Record<string, AttributeValue>): void {
  const day = deriveDay(item);
  const category = attrToString(item.tagCategory) || "other";
  const status = attrToString(item.processingStatus) || "unknown";
  const currency = attrToString(item.currency) || "unknown";
  const amountMinor = attrToNumber(item.amountMinor) || 0;

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

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message || "") : "";
  const name = "name" in error ? String(error.name || "") : "";
  return (
    name.includes("ValidationException") ||
    message.includes("Query condition missed key schema element") ||
    message.includes("The table does not have the specified index")
  );
}

async function queryByDayOrScan(days: number): Promise<Array<Record<string, AttributeValue>>> {
  const tableName = getTransactionsTableName();
  const { QueryCommand, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const client = await getDynamoClient();
  const dayRange = getDayRange(days);
  const allItems: Array<Record<string, AttributeValue>> = [];

  try {
    for (const day of dayRange) {
      let lastEvaluatedKey: Record<string, AttributeValue> | undefined;
      do {
        const response = await client.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: "ByDayAndTime",
            KeyConditionExpression: "eventDay = :eventDay",
            ExpressionAttributeValues: {
              ":eventDay": { S: day },
            },
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (response.Items) allItems.push(...response.Items);
        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }
    return allItems;
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
  }

  const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression:
          "eventDay, stripeCreatedAt, tagCategory, processingStatus, currency, amountMinor, receivedAt",
        FilterExpression: "receivedAt >= :threshold",
        ExpressionAttributeValues: {
          ":threshold": { N: `${thresholdMs}` },
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) allItems.push(...response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

export async function getStripeAnalyticsSnapshot(
  inputDays: number = 30
): Promise<StripeAnalyticsSnapshot> {
  const days = Math.max(1, Math.min(365, Math.trunc(inputDays)));
  const snapshot = emptySnapshot(days);
  const items = await queryByDayOrScan(days);

  for (const item of items) {
    applyItem(snapshot, item);
  }

  return snapshot;
}

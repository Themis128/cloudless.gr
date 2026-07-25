import type { AuthDatabase } from "@/lib/auth-d1"; // Type stub for AWS SDK modules declare module "@aws-sdk/client-cognito-identity-provider" { export class CognitoIdentityProviderClient { send(command: any): Promise<any>; } export class GetUserCommand { constructor(params: any>; } export class AdminGetUserCommand { constructor(params: any>; } export class AdminUpdateUserAttributesCommand { constructor(params: any>; } export class AdminEnableUserCommand { constructor(params: any>; } export class AdminDisableUserCommand { constructor(params: any>; } export class AdminCreateUserCommand { constructor(params: any>; } export class AdminDeleteUserCommand { constructor(params: any>; } export class AdminAddUserToGroupCommand { constructor(params: any>; } export class AdminRemoveUserFromGroupCommand { constructor(params: any>; } export class AdminResetUserPasswordCommand { constructor(params: any>; } export class AdminInitiateAuthCommand { constructor(params: any>; } export class RespondToAuthChallengeCommand { constructor(params: any>; } export class SignUpCommand { constructor(params: any>; } export class ConfirmSignUpCommand { constructor(params: any>; } export class ResendConfirmationCodeCommand { constructor(params: any>; } export class ForgotPasswordCommand { constructor(params: any>; } export class ConfirmForgotPasswordCommand { constructor(params: any>; } export class AdminUserGlobalSignOutCommand { constructor(params: any>; } export class AdminGetUserResponse { UserAttributes?: Array<{ Name: string; Value: string }>; } export class ListUsersCommand { constructor(params: any>; } export class AdminListGroupsForUserCommand { constructor(params: any>; } export interface UserType { Username?: string; UserPoolId?: string; UserStatus?: string; Attributes?: Array<{ Name: string; Value: string }>; } } declare module "@aws-sdk/client-dynamodb" { export class DynamoDBClient { constructor(config?: any>; send(command: any>; Promise<any>; } export class GetItemCommand { constructor(params: any>; } export class PutItemCommand { constructor(params: any>; } export class UpdateItemCommand { constructor(params: any>; } export class DeleteItemCommand { constructor(params: any>; } export class QueryCommand { constructor(params: any>; } export class ScanCommand { constructor(params: any>; } export class BatchWriteItemCommand { constructor(params: any>; } export class ConditionalCheckFailedException extends Error {} } declare module "@aws-sdk/client-s3" { export class S3Client { constructor(config?: any>; send(command: any>; Promise<any>; } export class HeadObjectCommand { constructor(params: any>; } export class PutObjectCommand { constructor(params: any>; } export class GetObjectCommand { constructor(params: any>; } }
import type Stripe from "stripe";

const REGION = process.env.AWS_REGION || "us-east-1";
const APP_SOURCE_TAG = "cloudless.gr";
const ANALYTICS_RETENTION_DAYS = 400;

let dynamoClient: any = null;

export function resolveDynamoEndpoint(): string | undefined {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  if (!endpoint) return undefined;

  const allowInsecureLocalhost =
    endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1");

  if (!endpoint.startsWith("https://") && !allowInsecureLocalhost) {
    throw new Error("DynamoDB endpoint must use HTTPS for encrypted transit");
  }

  return endpoint;
}

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

async function getDynamoClient() {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: REGION,
      endpoint: resolveDynamoEndpoint(),
    });
  }
  return dynamoClient;
}

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

function getTransactionsTableName(): string | null {
  return process.env.STRIPE_TRANSACTIONS_TABLE?.trim() || null;
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

function toExpiryEpoch(unixSeconds: number): number {
  return unixSeconds + ANALYTICS_RETENTION_DAYS * 24 * 60 * 60;
}

function buildItem(event: Stripe.Event): Record<string, AttributeValue> {
  const object = event.data.object as unknown as Record<string, unknown>;
  const amountMinor =
    asNumber(object.amount_total) ?? asNumber(object.amount_due) ?? asNumber(object.amount_paid);

  const objectId = asString(object.id);
  const currency = asString(object.currency);
  const paymentStatus = asString(object.payment_status) ?? asString(object.status);
  const customerId = asString(object.customer);
  const customerEmail = asString(object.customer_email);
  const mode = asString(object.mode);
  const tags = getStripeEventTags(event.type);
  const eventDay = toEventDay(event.created);
  const stageCategory = `${tags.tagStage}#${tags.tagCategory}`;

  const item: Record<string, AttributeValue> = {
    eventId: { S: event.id },
    eventType: { S: event.type },
    tagSource: { S: tags.tagSource },
    tagStage: { S: tags.tagStage },
    tagCategory: { S: tags.tagCategory },
    stageCategory: { S: stageCategory },
    eventDay: { S: eventDay },
    receivedAt: { N: `${Date.now()}` },
    stripeCreatedAt: { N: `${event.created}` },
    expiresAt: { N: `${toExpiryEpoch(event.created)}` },
    processingStatus: { S: "received" },
    livemode: { BOOL: event.livemode },
    payloadJson: { S: toJson(event.data.object) },
  };

  if (objectId) item.objectId = { S: objectId };
  if (currency) item.currency = { S: currency };
  if (paymentStatus) item.paymentStatus = { S: paymentStatus };
  if (customerId) item.customerId = { S: customerId };
  if (customerEmail) item.customerEmail = { S: customerEmail };
  if (mode) item.checkoutMode = { S: mode };
  if (typeof amountMinor === "number") item.amountMinor = { N: `${amountMinor}` };

  return item;
}

export interface PersistStripeEventResult {
  duplicate: boolean;
}

/**
 * Persist a Stripe webhook event to D1 (primary) or DynamoDB (fallback).
 * D1 uses INSERT OR IGNORE for duplicate detection.
 */
export async function persistStripeEvent(event: Stripe.Event): Promise<PersistStripeEventResult> {
  const object = event.data.object as unknown as Record<string, unknown>;
  const customerId = asString(object.customer);
  const payloadJson = toJson(event.data.object);

  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO stripe_transaction (event_id, event_type, customer_id, processing_status, received_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(
          event.id,
          event.type,
          customerId || null,
          "received",
          Math.floor(Date.now() / 1000),
          payloadJson
        )
        .run();
      // changes === 0 means the row was ignored (duplicate PK)
      const duplicate = (result.meta?.changes ?? 0) === 0;
      if (!duplicate) {
        sinkStripeEventToLake(event).catch(() => {});
      }
      return { duplicate };
    } catch (err) {
      console.warn(
        "[stripe-transactions] D1 persistStripeEvent failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const tableName = getTransactionsTableName();
  if (!tableName) throw new Error("STRIPE_TRANSACTIONS_TABLE is not configured");
  const client = await getDynamoClient();

  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: buildItem(event),
        ConditionExpression: "attribute_not_exists(eventId)",
      })
    );
    // Sink to data lake for analytics (fire-and-forget)
    sinkStripeEventToLake(event).catch(() => {});
    return { duplicate: false };
  } catch (error) {
    if (
      error instanceof ConditionalCheckFailedException ||
      (error as { name?: string })?.name === "ConditionalCheckFailedException"
    ) {
      return { duplicate: true };
    }
    throw error;
  }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      await db
        .prepare("UPDATE stripe_transaction SET processing_status = ? WHERE event_id = ?")
        .bind("processed", eventId)
        .run();
      return;
    } catch (err) {
      console.warn(
        "[stripe-transactions] D1 markStripeEventProcessed failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const tableName = getTransactionsTableName();
  if (!tableName) return;
  const client = await getDynamoClient();
  await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { eventId: { S: eventId } },
      UpdateExpression:
        "SET processingStatus = :status, processedAt = :processedAt REMOVE processingError",
      ExpressionAttributeValues: {
        ":status": { S: "processed" },
        ":processedAt": { N: `${Date.now()}` },
      },
    })
  );
}

export async function markStripeEventFailed(eventId: string, errorMessage: string): Promise<void> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      await db
        .prepare("UPDATE stripe_transaction SET processing_status = ? WHERE event_id = ?")
        .bind("handler_failed", eventId)
        .run();
      return;
    } catch (err) {
      console.warn(
        "[stripe-transactions] D1 markStripeEventFailed failed, falling back to DynamoDB:",
        err instanceof Error ? err.message : err
      );
      // Fall through to DynamoDB
    }
  }

  const tableName = getTransactionsTableName();
  if (!tableName) return;
  const client = await getDynamoClient();
  await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { eventId: { S: eventId } },
      UpdateExpression:
        "SET processingStatus = :status, processedAt = :processedAt, processingError = :error",
      ExpressionAttributeValues: {
        ":status": { S: "handler_failed" },
        ":processedAt": { N: `${Date.now()}` },
        ":error": { S: errorMessage.slice(0, 1000) },
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Data Lake sink — writes Stripe events to R2 (primary) or S3 (fallback).
// ---------------------------------------------------------------------------


interface R2Env {
  DATALAKE_BUCKET: R2Bucket;
}

function getLakeR2(): R2Bucket | null {
  return (process.env as unknown as R2Env).DATALAKE_BUCKET ?? null;
}

const LAKE_BUCKET = process.env.ANALYTICS_S3_BUCKET || "cloudless-analytics-data";

let s3Lake: S3Client | null = null;
function getLakeS3(): S3Client {
  s3Lake ??= new S3Client({ region: REGION });
  return s3Lake;
}

async function sinkStripeEventToLake(event: Stripe.Event): Promise<void> {
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

  // Try R2 first (Cloudflare Workers)
  const r2 = getLakeR2();
  if (r2) {
    try {
      await r2.put(key, record, { customMetadata: { contentType: "application/x-ndjson" } });
      return;
    } catch (err) {
      console.warn(
        "[stripe-transactions] R2 sink failed, falling back to S3:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Fallback to S3
  await getLakeS3().send(
    new PutObjectCommand({
      Bucket: LAKE_BUCKET,
      Key: key,
      Body: record,
      ContentType: "application/x-ndjson",
    })
  );
}

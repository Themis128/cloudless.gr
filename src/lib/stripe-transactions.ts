import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import type Stripe from "stripe";

const REGION = process.env.AWS_REGION || "us-east-1";
const APP_SOURCE_TAG = "cloudless.gr";

let dynamoClient: DynamoDBClient | null = null;

export function resolveDynamoEndpoint(): string | undefined {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  if (!endpoint) return undefined;

  const allowInsecureLocalhost =
    endpoint.startsWith("http://localhost") ||
    endpoint.startsWith("http://127.0.0.1");

  if (!endpoint.startsWith("https://") && !allowInsecureLocalhost) {
    throw new Error("DynamoDB endpoint must use HTTPS for encrypted transit");
  }

  return endpoint;
}

function getDynamoClient(): DynamoDBClient {
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

function getTransactionsTableName(): string {
  const tableName = process.env.STRIPE_TRANSACTIONS_TABLE?.trim();
  if (tableName) return tableName;
  throw new Error("STRIPE_TRANSACTIONS_TABLE is not configured");
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

function buildItem(event: Stripe.Event): Record<string, AttributeValue> {
  const object = event.data.object as unknown as Record<string, unknown>;
  const amountMinor =
    asNumber(object.amount_total) ??
    asNumber(object.amount_due) ??
    asNumber(object.amount_paid);

  const objectId = asString(object.id);
  const currency = asString(object.currency);
  const paymentStatus = asString(object.payment_status) ?? asString(object.status);
  const customerId = asString(object.customer);
  const customerEmail = asString(object.customer_email);
  const mode = asString(object.mode);
  const tags = getStripeEventTags(event.type);

  const item: Record<string, AttributeValue> = {
    eventId: { S: event.id },
    eventType: { S: event.type },
    tagSource: { S: tags.tagSource },
    tagStage: { S: tags.tagStage },
    tagCategory: { S: tags.tagCategory },
    receivedAt: { N: `${Date.now()}` },
    stripeCreatedAt: { N: `${event.created}` },
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

export async function persistStripeEvent(
  event: Stripe.Event,
): Promise<PersistStripeEventResult> {
  const tableName = getTransactionsTableName();
  const client = getDynamoClient();

  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: buildItem(event),
        ConditionExpression: "attribute_not_exists(eventId)",
      }),
    );
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
  const tableName = getTransactionsTableName();
  const client = getDynamoClient();
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
    }),
  );
}

export async function markStripeEventFailed(
  eventId: string,
  errorMessage: string,
): Promise<void> {
  const tableName = getTransactionsTableName();
  const client = getDynamoClient();
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
    }),
  );
}

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import type { AuthDatabase } from "@/lib/auth-d1";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

// Local helper function for DynamoDB client
function getDynamoEndpoint(): string | undefined {
  return resolveDynamoEndpoint();
}

/**
 * Provider-agnostic user-profile store that supports both D1 and DynamoDB.
 *
 * The dashboard Profile/Settings form needs to persist name / company / phone /
 * preferences. On Cloudflare Workers (where AUTH_DB is available), uses D1.
 * On AWS Lambda, falls back to DynamoDB.
 */

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

// DynamoDB client (fallback)
let dynamoClient: DynamoDBClient | null = null;
function getDynamoClient(): DynamoDBClient {
  dynamoClient ??= new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: getDynamoEndpoint(),
  });
  return dynamoClient;
}

function getTableName(): string {
  const name = process.env.USER_PROFILE_TABLE?.trim();
  if (!name) throw new Error("USER_PROFILE_TABLE is not configured");
  return name;
}

export interface UserProfile {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

/** Read a user's stored profile. Returns {} when no record exists yet. */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      const result = await db
        .prepare(
          "SELECT name, company, phone, preferences_json as preferences FROM user WHERE id = ?"
        )
        .bind(userId)
        .first<{ name: string; company: string; phone: string; preferences: string }>();

      if (!result) return {};

      let preferences: unknown;
      if (result.preferences) {
        try {
          preferences = JSON.parse(result.preferences);
        } catch {
          // Ignore malformed stored preferences
        }
      }

      return {
        name: result.name,
        company: result.company,
        phone: result.phone,
        preferences,
      };
    } catch {
      // Fall through to DynamoDB
    }
  }

  // DynamoDB fallback
  const res = await getDynamoClient().send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
    })
  );
  const item = res.Item;
  if (!item) return {};

  let preferences: unknown;
  const rawPrefs = item.preferences?.S;
  if (rawPrefs) {
    try {
      preferences = JSON.parse(rawPrefs);
    } catch {
      // Ignore malformed stored preferences
    }
  }

  return {
    name: item.name?.S,
    company: item.company?.S,
    phone: item.phone?.S,
    preferences,
  };
}

/**
 * Upsert the provided profile fields, keyed by userId.
 *
 * Partial update: only the keys present in `fields` are written. A string set
 * to "" clears that attribute; `undefined` leaves it untouched.
 */
export async function putUserProfile(userId: string, fields: UserProfile): Promise<void> {
  // Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(
          "UPDATE user SET name = ?, company = ?, phone = ?, preferences_json = ?, updated_at = ? WHERE id = ?"
        )
        .bind(
          fields.name || null,
          fields.company || null,
          fields.phone || null,
          fields.preferences ? JSON.stringify(fields.preferences) : null,
          now,
          userId
        )
        .run();
      return;
    } catch {
      // Fall through to DynamoDB
    }
  }

  // DynamoDB fallback
  const setParts: string[] = [];
  const removeParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, AttributeValue> = {};

  const handleString = (attr: string, value: string | undefined): void => {
    if (value === undefined) return;
    names[`#${attr}`] = attr;
    if (value === "") {
      removeParts.push(`#${attr}`);
      return;
    }
    setParts.push(`#${attr} = :${attr}`);
    values[`:${attr}`] = { S: value };
  };

  handleString("name", fields.name);
  handleString("company", fields.company);
  handleString("phone", fields.phone);
  if (fields.preferences !== undefined) {
    names["#preferences"] = "preferences";
    setParts.push("#preferences = :preferences");
    values[":preferences"] = { S: JSON.stringify(fields.preferences) };
  }

  if (setParts.length === 0 && removeParts.length === 0) return;

  const clauses: string[] = [];
  if (setParts.length) clauses.push(`SET ${setParts.join(", ")}`);
  if (removeParts.length) clauses.push(`REMOVE ${removeParts.join(", ")}`);

  await getDynamoClient().send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
      UpdateExpression: clauses.join(" "),
      ExpressionAttributeNames: names,
      ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
    })
  );
}

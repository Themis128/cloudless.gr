/**
 * Provider-agnostic user-profile store that supports both D1 and DynamoDB.
 *
 * The dashboard Profile/Settings form needs to persist name / company / phone /
 * preferences. On Cloudflare Workers (where AUTH_DB is available), uses D1.
 * On AWS Lambda, falls back to DynamoDB.
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AuthDatabase } from "@/lib/auth-d1";

const REGION = process.env.AWS_REGION || "us-east-1";

// ---------------------------------------------------------------------------
// DynamoDB helpers (lazy singleton)
// ---------------------------------------------------------------------------

let dynamoClient: DynamoDBClient | null = null;

async function getDynamoClient(): Promise<DynamoDBClient> {
  if (!dynamoClient) {
    const { DynamoDBClient: DC } = await import("@aws-sdk/client-dynamodb");
    dynamoClient = new DC({
      region: REGION,
      endpoint: process.env.DYNAMODB_ENDPOINT?.trim() || undefined,
    });
  }
  return dynamoClient;
}

function getTableName(): string {
  const name = process.env.USER_PROFILE_TABLE?.trim();
  if (!name) throw new Error("USER_PROFILE_TABLE is not configured");
  return name;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<Record<string, any> | null> {
  // Try D1 first (Cloudflare Workers)
  const db = (globalThis as any)?.__AUTH_DB__;
  if (db) {
    try {
      const row = await db.prepare(
        "SELECT preferences_json FROM user WHERE id = ?"
      ).bind(userId).first();
      if (row?.preferences_json) {
        return JSON.parse(row.preferences_json);
      }
    } catch {
      // Fall through
    }
  }

  const table = getTableName();
  if (!table) return null;
  try {
    const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
    const c = await getDynamoClient();
    const res = await c.send(
      new GetItemCommand({
        TableName: table,
        Key: { userId: { S: userId } },
      })
    );
    if (!res.Item) return null;
    const profileJson = res.Item.profile_json?.S ?? "{}";
    return JSON.parse(profileJson);
  } catch {
    return null;
  }
}

export async function updateUserProfile(userId: string, profile: Record<string, any>): Promise<void> {
  const profileJson = JSON.stringify(profile);

  // Try D1 first (Cloudflare Workers)
  const db = (globalThis as any)?.__AUTH_DB__;
  if (db) {
    try {
      await db.prepare(
        "UPDATE user SET preferences_json = ? WHERE id = ?"
      ).bind(profileJson, userId).run();
      return;
    } catch {
      // Fall through
    }
  }

  const table = getTableName();
  if (!table) return;
  try {
    const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
    const c = await getDynamoClient();
    await c.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { userId: { S: userId } },
        UpdateExpression: "SET profile_json = :p, updated_at = :u",
        ExpressionAttributeValues: {
          ":p": { S: profileJson },
          ":u": { N: String(Math.floor(Date.now() / 1000)) },
        },
      })
    );
  } catch (err) {
    console.error("[user-profile] update failed:", err);
  }
}

// Backward-compatible alias used by src/app/api/user/profile/route.ts
export async function putUserProfile(userId: string, profile: Record<string, any>): Promise<void> {
  return updateUserProfile(userId, profile);
}

/**
 * DynamoDB-backed token store for next-auth JWT sessions (Issue #933).
 *
 * Keeps idToken + refreshToken out of the encrypted session cookie to avoid
 * hitting the 4KB cookie / CloudFront header size limit. The JWT cookie now
 * carries only the user's sub, groups, expiresAt — tokens are fetched from
 * DynamoDB when needed (token refresh, session callback).
 *
 * Table: SESSION_TOKEN_STORE_TABLE (sst.config.ts → "SessionTokenStore")
 *   hashKey: userId (OIDC sub)
 *   Attributes: idToken, refreshToken, updatedAt
 *   TTL attribute: expiresAt (epoch seconds, 30-day sliding window)
 */

import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

const REGION = process.env.AWS_REGION || "us-east-1";
const TTL_DAYS = 30;

let client: any = null;

async function getClient() {
  if (!client) {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    client = new DynamoDBClient({ region: REGION, endpoint: resolveDynamoEndpoint() });
  }
  return client;
}

function getTableName(): string {
  const name = process.env.SESSION_TOKEN_STORE_TABLE?.trim();
  if (!name) throw new Error("SESSION_TOKEN_STORE_TABLE is not configured");
  return name;
}

export interface StoredTokens {
  idToken: string;
  refreshToken: string;
}

export async function getTokens(userId: string): Promise<StoredTokens | null> {
  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const c = await getClient();
  const res = await c.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
      ProjectionExpression: "idToken, refreshToken",
    })
  );
  const item = res.Item;
  if (!item?.idToken?.S || !item?.refreshToken?.S) return null;
  return { idToken: item.idToken.S, refreshToken: item.refreshToken.S };
}

export async function putTokens(userId: string, tokens: StoredTokens): Promise<void> {
  const { PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const c = await getClient();
  const now = Math.floor(Date.now() / 1000);
  await c.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: {
        userId: { S: userId },
        idToken: { S: tokens.idToken },
        refreshToken: { S: tokens.refreshToken },
        updatedAt: { N: String(now) },
        expiresAt: { N: String(now + TTL_DAYS * 86400) },
      },
    })
  );
}

export async function deleteTokens(userId: string): Promise<void> {
  const { DeleteItemCommand } = await import("@aws-sdk/client-dynamodb");
  const c = await getClient();
  await c.send(
    new DeleteItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
    })
  );
}
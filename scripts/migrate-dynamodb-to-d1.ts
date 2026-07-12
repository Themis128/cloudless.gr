#!/usr/bin/env tsx

/**
 * Migrate DynamoDB tables to D1 for Cloudflare Free Tier migration.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=x AWS_PROFILE=default npx tsx scripts/migrate-dynamodb-to-d1.ts
 */

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { exec } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION || "us-east-1";

// Column mappings: DynamoDB attribute name → D1 column name
// Based on actual D1 schema from migrations/0001-auth-schema.sql + schema-migration-v2.sql
const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  // D1 user table: id, username, password_hash, email, name, company, phone, preferences_json, created_at, updated_at, status
  // DynamoDB UserProfile only has: userId, preferences (no email/password - those come from Cognito)
  user: {
    userId: "id",
    preferences: "preferences_json",
  },
  // D1 user_token table: user_id, id_token, refresh_token, updated_at, expires_at
  user_token: {
    userId: "user_id",
    idToken: "id_token",
    refreshToken: "refresh_token",
    expiresAt: "expires_at",
    updatedAt: "updated_at",
  },
  // D1 stripe_transaction ACTUAL schema: event_id, event_type, customer_id, processing_status, received_at, payload_json
  // DynamoDB has many extra columns not in D1 schema - only map the ones that exist
  stripe_transaction: {
    eventId: "event_id",
    eventType: "event_type",
    customerId: "customer_id",
    processingStatus: "processing_status",
    receivedAt: "received_at",
    payloadJson: "payload_json",
    // Note: livemode, currency, etc. are not in actual D1 schema - they're in DynamoDB but ignored
  },
  // D1 admin_notification ACTUAL schema: pk, sk, category, payload_json, created_at
  // DynamoDB has extra columns (catPk, catSk, etc.) - only map what exists in D1
  admin_notification: {
    pk: "pk",
    sk: "sk",
    category: "category",
    metadata: "payload_json",
    createdAt: "created_at",
  },
  // D1 analytics_cache table: pk, sk, result_json, cached_at, expires_at
  analytics_cache: {
    pk: "pk",
    sk: "sk",
    payload: "result_json",
    storedAt: "cached_at",
    ttlSeconds: "expires_at",
  },
};

const TABLES = [
  { dynamo: "cloudless-production-UserProfileTable-bctubzrn", d1: "user" },
  { dynamo: "cloudless-production-SessionTokenStoreTable-mrbwcwzt", d1: "user_token" },
  { dynamo: "cloudless-production-StripeTransactionsTable-nhtvnuew", d1: "stripe_transaction" },
  { dynamo: "cloudless-production-AdminNotificationsTable-uuhacatu", d1: "admin_notification" },
  { dynamo: "cloudless-production-AnalyticsCacheTable-fneaemkr", d1: "analytics_cache" },
];

function getDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({ region: REGION });
}

async function executeSql(sql: string): Promise<void> {
  const tmpFile = join(tmpdir(), `d1-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  await writeFile(tmpFile, sql);
  
  return new Promise((resolve, reject) => {
    exec(
      `npx wrangler d1 execute user-auth-db --remote --file="${tmpFile}"`,
      { stdio: "inherit", env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN } },
      (error) => {
        unlink(tmpFile).catch(() => {});
        error ? reject(error) : resolve();
      }
    );
  });
}

function formatValue(attr: Record<string, unknown>): string {
  if (attr.S !== undefined) return `'${String(attr.S).replace(/'/g, "''")}'`;
  if (attr.N !== undefined) return String(attr.N);
  if (attr.BOOL !== undefined) return attr.BOOL ? "1" : "0";
  if (attr.NULL !== undefined) return "NULL";
  if (attr.SS !== undefined) return `'${JSON.stringify(attr.SS).replace(/'/g, "''")}'`;
  if (attr.NS !== undefined) return `'${JSON.stringify(attr.NS).replace(/'/g, "''")}'`;
  if (attr.L !== undefined) return `'${JSON.stringify(attr.L).replace(/'/g, "''")}'`;
  if (attr.M !== undefined) return `'${JSON.stringify(attr.M).replace(/'/g, "''")}'`;
  return "NULL";
}

async function migrateUserTable(dynamoTable: string, d1Table: string): Promise<number> {
  const client = getDynamoClient();
  let count = 0;
  const mapping = COLUMN_MAPPINGS[d1Table] || {};
  const now = Math.floor(Date.now() / 1000);

  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: dynamoTable,
        ExclusiveStartKey,
      })
    );

    const items = result.Items || [];

    for (const item of items) {
      // For user table, we need to handle missing required columns
      // D1 requires: id, username, password_hash, email, created_at, updated_at (NOT NULL)
      // DynamoDB UserProfile only has: userId, preferences
      
      const userId = item.userId?.S || randomUUID();
      const email = item.email?.S || `${userId}@cloudless.gr.placeholder`;
      
      const columns = ["id", "username", "email", "password_hash", "preferences_json", "created_at", "updated_at"];
      
      const values = [
        `'${userId}'`,
        `'${email}'`, // username defaults to email
        `'${email}'`,
        "''", // password_hash - empty, user needs to reset
        item.preferences ? formatValue(item.preferences) : "NULL",
        String(now),
        String(now),
      ];

      const sql = `INSERT OR REPLACE INTO ${d1Table} (${columns.join(", ")}) VALUES (${values.join(", ")})`;

      try {
        await executeSql(sql);
        count++;
      } catch (err) {
        console.error(`[migrate] Failed to insert into ${d1Table}:`, err);
      }
    }

    ExclusiveStartKey = result.LastEvaluatedKey;
    await new Promise((r) => setTimeout(r, 100));
  } while (ExclusiveStartKey);

  console.log(`[migrate] Migrated ${count} items from ${dynamoTable} to ${d1Table}`);
  return count;
}

async function migrateTable(dynamoTable: string, d1Table: string): Promise<number> {
  // Special handling for user table
  if (d1Table === "user") {
    return migrateUserTable(dynamoTable, d1Table);
  }

  const client = getDynamoClient();
  let count = 0;
  const mapping = COLUMN_MAPPINGS[d1Table] || {};

  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: dynamoTable,
        ExclusiveStartKey,
      })
    );

    const items = result.Items || [];

    for (const item of items) {
      const attrNames = Object.keys(item);
      
      // Filter to only columns that exist in both DynamoDB and mapping
      const validAttrs = attrNames.filter((col) => {
        const d1Col = mapping[col];
        if (!d1Col) return false;
        // Skip columns that would fail NOT NULL constraints with empty values
        if (!item[col]) return false;
        return true;
      });
      
      const columns = validAttrs.map((col) => mapping[col]);
      const values = validAttrs.map((col) => formatValue(item[col]));

      if (columns.length === 0) continue;

      const sql = `INSERT OR REPLACE INTO ${d1Table} (${columns.join(", ")}) VALUES (${values.join(", ")})`;

      try {
        await executeSql(sql);
        count++;
      } catch (err) {
        console.error(`[migrate] Failed to insert into ${d1Table}:`, err);
      }
    }

    ExclusiveStartKey = result.LastEvaluatedKey;
    await new Promise((r) => setTimeout(r, 100));
  } while (ExclusiveStartKey);

  console.log(`[migrate] Migrated ${count} items from ${dynamoTable} to ${d1Table}`);
  return count;
}

async function main() {
  console.log("[migrate] Starting DynamoDB to D1 migration...\n");

  // Check if CLOUDFLARE_API_TOKEN is available
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error("[migrate] ERROR: CLOUDFLARE_API_TOKEN environment variable is required");
    process.exit(1);
  }

  let totalMigrated = 0;

  for (const { dynamo, d1 } of TABLES) {
    try {
      console.log(`[migrate] Migrating ${dynamo} → ${d1}...`);
      const count = await migrateTable(dynamo, d1);
      totalMigrated += count;
    } catch (err) {
      console.error(`[migrate] Failed to migrate ${dynamo}:`, err);
    }
  }

  console.log(`\n[migrate] Migration complete. Total items migrated: ${totalMigrated}`);
}

main().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
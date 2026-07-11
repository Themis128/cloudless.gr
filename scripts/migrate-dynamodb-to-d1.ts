#!/usr/bin/env tsx

/**
 * Migrate DynamoDB tables to D1 for Cloudflare Free Tier migration.
 *
 * Usage:
 *   AWS_PROFILE=default npx tsx scripts/migrate-dynamodb-to-d1.ts
 */

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { exec } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const REGION = process.env.AWS_REGION || "us-east-1";

const TABLES = [
  { dynamo: "cloudless-production-UserProfileTable-bctubzrn", d1: "user" },
  { dynamo: "cloudless-production-SessionTokenStoreTable-mrbwcwzt", d1: "session" },
  { dynamo: "cloudless-production-StripeTransactionsTable-nhtvnuew", d1: "stripe_transaction" },
  { dynamo: "cloudless-production-AdminNotificationsTable-uuhacatu", d1: "admin_notification" },
  { dynamo: "cloudless-production-AnalyticsCacheTable-fneaemkr", d1: "analytics_cache" },
];

function getDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({ region: REGION });
}

async function executeSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(
      `echo "${sql}" | npx wrangler d1 execute user-auth-db --remote`,
      { stdio: "inherit" },
      (error) => (error ? reject(error) : resolve())
    );
  });
}

async function migrateTable(dynamoTable: string, d1Table: string): Promise<number> {
  const client = getDynamoClient();
  let count = 0;

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
      const columns = Object.keys(item);
      const values = columns.map((col) => {
        const attr = item[col];
        if (attr.S !== undefined) return `'${attr.S.replace(/'/g, "''")}'`;
        if (attr.N !== undefined) return attr.N;
        if (attr.BOOL !== undefined) return attr.BOOL ? 1 : 0;
        if (attr.NULL !== undefined) return "NULL";
        if (attr.SS !== undefined) return `'${JSON.stringify(attr.SS)}'`;
        if (attr.NS !== undefined) return `'${JSON.stringify(attr.NS)}'`;
        if (attr.L !== undefined) return `'${JSON.stringify(attr.L)}'`;
        if (attr.M !== undefined) return `'${JSON.stringify(attr.M)}'`;
        return "NULL";
      });

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
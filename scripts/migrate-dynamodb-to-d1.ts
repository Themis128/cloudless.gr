#!/usr/bin/env tsx

/**
 * Migrate DynamoDB tables to D1 for Cloudflare Free Tier migration.
 *
 * Usage:
 *   AWS_PROFILE=default npx tsx scripts/migrate-dynamodb-to-d1.ts
 *
 * This script reads all data from DynamoDB and inserts it into D1.
 */

import { DynamoDBClient, ScanCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { execSync } from "child_process";

const REGION = process.env.AWS_REGION || "us-east-1";

const TABLES = [
  { dynamo: "cloudless-user-profiles", d1: "user" },
  { dynamo: "cloudless-session-tokens", d1: "session" },
  { dynamo: "cloudless-stripe-transactions", d1: "stripe_transaction" },
  { dynamo: "cloudless-admin-notifications", d1: "admin_notification" },
  { dynamo: "cloudless-analytics-cache", d1: "analytics_cache" },
];

function getDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({ region: REGION });
}

async function migrateTable(dynamoTable: string, d1Table: string): Promise<number> {
  const client = getDynamoClient();
  let count = 0;

  // Scan all items (for large tables, use pagination)
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
      // Convert DynamoDB format to SQL
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
        execSync(
          `echo "${sql}" | npx wrangler d1 execute user-auth-db --command - --remote`,
          { stdio: "inherit" }
        );
        count++;
      } catch (err) {
        console.error(`[migrate] Failed to insert item into ${d1Table}:`, err);
      }
    }

    ExclusiveStartKey = result.LastEvaluatedKey;
    
    // Rate limit to avoid throttling
    await new Promise((resolve) => setTimeout(resolve, 100));
    
  } while (ExclusiveStartKey);

  console.log(`[migrate] Migrated ${count} items from ${dynamoTable} to ${d1Table}`);
  return count;
}

async function main() {
  console.log("[migrate] Starting DynamoDB to D1 migration...");
  console.log("[migrate] Make sure wrangler is configured with correct account and D1 database exists.\n");

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
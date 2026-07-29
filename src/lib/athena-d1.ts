/**
 * D1-based replacement for AWS Athena query functionality
 * Provides similar interface to athena.ts but using Cloudflare D1 database
 */

import { D1Database } from "@cloudflare/workers-types";

// Type definitions to match the original athena.ts interface
export interface AthenaQueryResult {
  rows: Array<Record<string, string | number | null>>;
  rowCount: number;
  fromCache: boolean;
}

/**
 * Initialize the D1-based Athena replacement
 * @param env Cloudflare environment bindings containing DB (D1 database)
 */
export function initializeAthenaD1(env: { DB: D1Database }) {
  // Store the DB instance for use in query functions
  // In a real implementation, we might want to set up tables, etc.
  return { DB: env.DB };
}

/**
 * Execute a SQL query against the D1 database
 * @param sql SQL query to execute
 * @param maxRows Maximum number of rows to return
 * @returns Query results in the same format as the original runAthenaQuery
 */
export async function runAthenaD1Query(
  db: D1Database,
  sql: string,
  maxRows: number = 100
): Promise<AthenaQueryResult> {
  try {
    // Execute the query
    const result = await db.prepare(sql).all();

    // Convert to the expected format
    const rows: Array<Record<string, string | number | null>> = [];

    if (result.results && Array.isArray(result.results)) {
      for (const row of result.results.slice(0, maxRows)) {
        const typedRow: Record<string, string | number | null> = {};
        for (const [key, value] of Object.entries(row)) {
          // Convert values to appropriate types
          if (value === null) {
            typedRow[key] = null;
          } else if (typeof value === "number") {
            typedRow[key] = value;
          } else if (typeof value === "boolean") {
            typedRow[key] = value ? 1 : 0;
          } else {
            typedRow[key] = String(value);
          }
        }
        rows.push(typedRow);
      }
    }

    return {
      rows,
      rowCount: rows.length,
      fromCache: false, // D1 doesn't have built-in caching like Athena
    };
  } catch (error) {
    console.error("Error executing D1 query:", error);
    throw new Error(`D1 query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get list of tables in the database
 * @param db D1 database instance
 * @returns Array of table names
 */
export async function getAthenaD1Tables(db: D1Database): Promise<string[]> {
  try {
    // Query to get table names from SQLite schema
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();

    if (result.results && Array.isArray(result.results)) {
      return result.results
        .map((row: Record<string, unknown>) => row.name)
        .filter((name): name is string => typeof name === "string");
    }
    return [];
  } catch (error) {
    console.error("Error getting tables from D1:", error);
    return [];
  }
}

/**
 * Get schema information for a specific table
 * @param db D1 database instance
 * @param tableName Name of the table
 * @returns Array of objects containing column information
 */
export async function getAthenaD1TableSchema(
  db: D1Database,
  tableName: string
): Promise<Array<{ name: string; type: string }>> {
  try {
    // Use PRAGMA table_info to get schema
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();

    if (result.results && Array.isArray(result.results)) {
      return result.results
        .map((col: Record<string, unknown>) => ({
          name: String(col.name ?? ""),
          type: String(col.type ?? "UNKNOWN"),
        }))
        .filter(
          (col: { name: string }): col is { name: string; type: string } =>
            typeof col.name === "string" && col.name.length > 0
        );
    }
    return [];
  } catch (error) {
    console.error(`Error getting schema for table ${tableName}:`, error);
    return [];
  }
}

/**
 * List all available databases (in D1 context, we typically have one database)
 * @param db D1 database instance
 * @returns Array of database names
 */
export async function getAthenaD1Databases(_db: D1Database): Promise<string[]> {
  // In D1, we typically work with a single database
  // Return the database name if we can determine it, otherwise return a default
  return ["cloudless_analytics"]; // Default database name matching the original
}

/**
 * Get recent query execution history (not applicable for D1, returns empty array)
 * @param maxResults Maximum number of queries to return
 * @returns Empty array (D1 doesn't track query history like Athena)
 */
export async function getAthenaD1QueryHistory(
  _db: D1Database,
  _maxResults: number = 10
): Promise<Array<{ queryId: string; sql: string; timestamp: string }>> {
  // D1 doesn't have built-in query history tracking like Athena
  // Return empty array to maintain compatibility
  return [];
}

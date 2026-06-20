/**
 * Athena query helper for the admin /analytics/datalake dashboard.
 *
 * Wraps `start-query-execution` + poll + `get-query-results` into one
 * promise-returning function. Results are parsed into typed row objects.
 *
 * Caching: a tiny per-Lambda in-memory cache keyed by SQL text + 60s TTL.
 * Athena charges $5 / TB scanned — we don't want to re-scan the same view
 * on every dashboard refresh. The workgroup's BytesScannedCutoffPerQuery
 * cap (10 GB, set in the 2026-06-20 hardening pass) is the hard backstop.
 */

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  type Row,
} from "@aws-sdk/client-athena";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const WORKGROUP = process.env.ATHENA_WORKGROUP ?? "primary";
const DATABASE = process.env.ATHENA_DATABASE ?? "cloudless_analytics";
const CACHE_TTL_MS = 60 * 1_000;
const POLL_INTERVAL_MS = 750;
const MAX_POLL_ATTEMPTS = 40; // 40 × 750ms = 30s — past Lambda budget kills it

let _client: AthenaClient | null = null;
function getClient(): AthenaClient {
  _client ??= new AthenaClient({ region: REGION });
  return _client;
}

interface CacheEntry {
  rows: Record<string, string | number | null>[];
  at: number;
}
const cache = new Map<string, CacheEntry>();

export interface AthenaQueryResult {
  rows: Record<string, string | number | null>[];
  rowCount: number;
  fromCache: boolean;
}

/** Run a single Athena SELECT and return parsed rows. */
export async function runAthenaQuery(
  sql: string,
  options: { ttlMs?: number; skipCache?: boolean } = {}
): Promise<AthenaQueryResult> {
  const ttlMs = options.ttlMs ?? CACHE_TTL_MS;
  const cached = cache.get(sql);
  if (!options.skipCache && cached && Date.now() - cached.at < ttlMs) {
    return { rows: cached.rows, rowCount: cached.rows.length, fromCache: true };
  }

  const client = getClient();
  const start = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      WorkGroup: WORKGROUP,
      QueryExecutionContext: { Database: DATABASE },
    })
  );
  const id = start.QueryExecutionId;
  if (!id) throw new Error("Athena: no QueryExecutionId returned");

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const state = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: id })
    );
    const s = state.QueryExecution?.Status?.State;
    if (s === "SUCCEEDED") break;
    if (s === "FAILED" || s === "CANCELLED") {
      const reason = state.QueryExecution?.Status?.StateChangeReason ?? s;
      throw new Error(`Athena query ${s}: ${reason}`);
    }
    if (i === MAX_POLL_ATTEMPTS - 1) {
      throw new Error(`Athena query timeout after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
    }
  }

  const results = await client.send(new GetQueryResultsCommand({ QueryExecutionId: id }));
  const rows = parseRows(results.ResultSet?.Rows ?? []);
  cache.set(sql, { rows, at: Date.now() });
  return { rows, rowCount: rows.length, fromCache: false };
}

/**
 * Athena returns the column header in row 0 and data in subsequent rows.
 * Each cell may be string or numeric — we let numeric strings through as
 * strings so the dashboard formatter can decide presentation per column.
 */
function parseRows(raw: Row[]): Record<string, string | number | null>[] {
  if (raw.length === 0) return [];
  const headerRow = raw[0]?.Data ?? [];
  const headers = headerRow.map((c) => c.VarCharValue ?? "");
  const out: Record<string, string | number | null>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cols = raw[i]?.Data ?? [];
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, j) => {
      const v = cols[j]?.VarCharValue;
      obj[h] = v === undefined || v === null ? null : v;
    });
    out.push(obj);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Test hook — reset the in-process cache (used by route handler ?refresh=1). */
export function resetAthenaCache(): void {
  cache.clear();
}

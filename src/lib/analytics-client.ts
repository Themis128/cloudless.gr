/**
 * Client-side DuckDB-Wasm over R2 lake parquet (catalog allowlist only).
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";

export { LAKE_PARQUET_CATALOG } from "@/lib/lake-parquet-catalog";

type DuckConn = {
  query: (sql: string) => Promise<{ toArray: () => Record<string, unknown>[] }>;
  close: () => Promise<void>;
};

type DuckRuntime = {
  registerFileBuffer: (name: string, buffer: Uint8Array) => Promise<void>;
  connect: () => Promise<DuckConn>;
};

type DuckdbWasmModule = {
  getJsDelivrBundles: () => unknown;
  selectBundle: (bundles: unknown) => Promise<{
    mainWorker?: string;
    mainModule: string;
    pthreadWorker?: string;
  }>;
  ConsoleLogger: new (level?: number) => unknown;
  LogLevel: { WARNING: number };
  AsyncDuckDB: new (logger: unknown, worker: Worker) => DuckRuntime & {
    instantiate: (mainModule: string, pthreadWorker?: string | null) => Promise<void>;
  };
};

let dbPromise: Promise<DuckRuntime> | null = null;

async function getDuckDB(): Promise<DuckRuntime> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const duckdb = (await import("@duckdb/duckdb-wasm")) as unknown as DuckdbWasmModule;
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    if (!bundle.mainWorker) throw new Error("DuckDB worker URL missing");
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);
    return db;
  })();
  return dbPromise;
}

export function isDuckDBAvailable(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      typeof Worker !== "undefined" &&
      typeof crypto !== "undefined" &&
      typeof crypto.subtle !== "undefined"
  );
}

export async function queryLakeParquet(
  catalogId: string,
  sql: string
): Promise<Record<string, unknown>[]> {
  if (!isDuckDBAvailable()) return [];
  const res = await fetchWithAuth(
    `/api/admin/analytics/lake-parquet?id=${encodeURIComponent(catalogId)}`
  );
  if (!res.ok) throw new Error(`lake-parquet ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const db = await getDuckDB();
  const name = `lake_${catalogId.replace(/[^a-z0-9]/gi, "_")}.parquet`;
  await db.registerFileBuffer(name, bytes);
  const conn = await db.connect();
  try {
    await conn.query(`CREATE OR REPLACE VIEW lake AS SELECT * FROM read_parquet('${name}')`);
    const result = await conn.query(sql);
    return result.toArray();
  } finally {
    await conn.close();
  }
}

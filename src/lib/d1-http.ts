/**
 * D1 HTTP client for Node runtimes (Pi / OpenNext) that lack a Workers AUTH_DB binding.
 *
 * Uses the Cloudflare D1 REST API with CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
 * (already present on the Pi pod for Workers AI / Email Sending). Prefer the native
 * Workers binding when available — this is the Pi bridge, not a Workers replacement.
 *
 * Docs: POST /accounts/{account_id}/d1/database/{database_id}/query
 */

import type { AuthDatabase } from "@/lib/auth-d1";

/** Production user-auth-db — must match wrangler.jsonc `database_id`. */
export const DEFAULT_AUTH_D1_DATABASE_ID = "7ca74513-23c3-412a-b9ca-b0c55835973d";

type D1HttpQueryResult = {
  results?: Record<string, unknown>[];
  success?: boolean;
  meta?: { changes?: number; last_row_id?: number };
};

type D1HttpApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: D1HttpQueryResult[];
};

interface Stmt {
  bind: (...args: unknown[]) => Stmt;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
  first: <T = Record<string, unknown>>(col?: string) => Promise<T | null>;
}

function accountId(): string | undefined {
  return process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.CF_ACCOUNT_ID?.trim();
}

function apiToken(): string | undefined {
  const raw = process.env.CLOUDFLARE_API_TOKEN;
  const token = raw?.trim();
  // Reject obviously malformed tokens (embedded whitespace, too short, or a
  // shell-paste artifact like "... 2A7Ofk..."). A corrupted token must not
  // hijack auth — getAuthDbFromEnv() falls through to a healthier backend
  // (local D1 shim in dev, or the 503 "not configured" path in production).
  if (!token) return undefined;
  if (/\s/.test(raw ?? "")) return undefined;
  if (token.length < 32) return undefined;
  return token;
}

function databaseId(): string {
  return (
    process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() ||
    process.env.AUTH_D1_DATABASE_ID?.trim() ||
    DEFAULT_AUTH_D1_DATABASE_ID
  );
}

/** True when Pi/Node can reach remote D1 via the Cloudflare API. */
export function canUseD1Http(): boolean {
  return Boolean(accountId() && apiToken());
}

async function queryRemote(sql: string, params: unknown[]): Promise<D1HttpQueryResult> {
  const account = accountId();
  const token = apiToken();
  if (!account || !token) {
    throw new Error("D1 HTTP: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not configured");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId()}/query`;
  const res = await globalThis.fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const body = (await res.json()) as D1HttpApiResponse;
  if (!res.ok || body.success === false) {
    const msg =
      body.errors
        ?.map((e) => e.message)
        .filter(Boolean)
        .join("; ") || res.statusText;
    throw new Error(`D1 HTTP query failed (${res.status}): ${msg}`);
  }

  const first = body.result?.[0];
  if (!first) {
    throw new Error("D1 HTTP query returned no result payload");
  }
  return first;
}

function prepareHttp(sql: string): Stmt {
  let bound: unknown[] = [];

  const stmt: Stmt = {
    bind(...args: unknown[]) {
      bound = args;
      return stmt;
    },
    async all<T = Record<string, unknown>>() {
      const result = await queryRemote(sql, bound);
      return {
        results: (result.results ?? []) as T[],
        success: result.success !== false,
      };
    },
    async run() {
      const result = await queryRemote(sql, bound);
      return {
        success: result.success !== false,
        meta: { changes: result.meta?.changes ?? 0 },
      };
    },
    async first<T = Record<string, unknown>>(col?: string) {
      const result = await queryRemote(sql, bound);
      const row = result.results?.[0];
      if (!row) return null;
      if (col) {
        return (row[col] as T) ?? null;
      }
      return row as T;
    },
  };

  return stmt;
}

let cached: AuthDatabase | null | undefined;

/** Cached AUTH_DB-compatible client, or null when credentials are missing. */
export function getHttpAuthDb(): AuthDatabase | null {
  if (cached !== undefined) return cached;
  if (!canUseD1Http()) {
    cached = null;
    return null;
  }
  cached = {
    prepare: (query: string) => prepareHttp(query),
  };
  return cached;
}

/** Test hook — drop the cached client so env changes take effect. */
export function resetHttpAuthDbCache(): void {
  cached = undefined;
}

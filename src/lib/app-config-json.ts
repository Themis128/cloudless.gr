/**
 * JSON blobs formerly stored in AWS SSM String parameters.
 * Cloudflare-first: D1 `app_config` when AUTH_DB is bound, else in-memory
 * (dev/E2E) so admin routes keep working without AWS.
 */

import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";

const memory = new Map<string, string>();

function getDb(): AuthDatabase | null {
  try {
    return getAuthDbFromEnv();
  } catch {
    return null;
  }
}

export async function readJsonConfig<T>(key: string, fallback: T): Promise<T> {
  const db = getDb();
  if (db) {
    try {
      const row = await db
        .prepare("SELECT value FROM app_config WHERE key = ?")
        .bind(key)
        .first<{ value: string }>();
      if (!row?.value) return fallback;
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }
  const raw = memory.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonConfig(
  key: string,
  value: unknown,
  description?: string
): Promise<void> {
  const json = JSON.stringify(value);
  const db = getDb();
  if (db) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO app_config (key, value, description, updated_at)
         VALUES (?, ?, ?, strftime('%s', 'now'))`
      )
      .bind(key, json, description ?? "")
      .run();
    return;
  }
  memory.set(key, json);
}

/** Test helper — clear in-memory store. */
export function resetJsonConfigMemory(): void {
  memory.clear();
}

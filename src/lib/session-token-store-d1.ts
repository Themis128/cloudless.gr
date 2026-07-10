/**
 * D1-based token store — Cloudflare Workers migration path.
 *
 * Replaces DynamoDB SessionTokenStore with a D1 table.
 * The D1 binding is read from process.env.AUTH_DB (Next.js on Workers polyfill)
 * or passed explicitly. Falls back to DynamoDB when D1 is unavailable.
 */

import type { AuthDatabase } from "@/lib/auth-d1";

export interface StoredTokens {
  idToken: string;
  refreshToken: string;
}

const TTL_DAYS = 30;

function getD1Binding(): AuthDatabase | null {
  const db = (process as any).env?.AUTH_DB || (globalThis as any).__AUTH_DB__;
  if (db && typeof db.prepare === "function") return db as AuthDatabase;
  return null;
}

/** Detect Cloudflare Workers runtime. */
function isWorkers(): boolean {
  return (
    typeof (globalThis as any).caches !== "undefined" &&
    typeof process === "undefined"
  );
}

/** Detect if D1 is available (Workers with AUTH_DB binding). */
function hasD1(): boolean {
  return getD1Binding() !== null;
}

async function getTokensD1(userId: string): Promise<StoredTokens | null> {
  const db = getD1Binding();
  if (!db) return null;

  const row = await db
    .prepare("SELECT id_token, refresh_token FROM user_token WHERE user_id = ?")
    .bind(userId)
    .first<{ id_token: string; refresh_token: string }>();

  if (!row) return null;
  return { idToken: row.id_token, refreshToken: row.refresh_token };
}

async function putTokensD1(userId: string, tokens: StoredTokens): Promise<void> {
  const db = getD1Binding();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TTL_DAYS * 86400;

  await db
    .prepare(
      `INSERT INTO user_token (user_id, id_token, refresh_token, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         id_token = excluded.id_token,
         refresh_token = excluded.refresh_token,
         updated_at = excluded.updated_at,
         expires_at = excluded.expires_at`
    )
    .bind(userId, tokens.idToken, tokens.refreshToken, now, expiresAt)
    .run();
}

async function deleteTokensD1(userId: string): Promise<void> {
  const db = getD1Binding();
  if (!db) return;

  await db.prepare("DELETE FROM user_token WHERE user_id = ?").bind(userId).run();
}

// DynamoDB fallback — lazy-loaded so it only imports AWS SDK when needed
async function getDynamoTokens(userId: string): Promise<StoredTokens | null> {
  const { getTokens } = await import("@/lib/session-token-store");
  return getTokens(userId);
}

async function putDynamoTokens(userId: string, tokens: StoredTokens): Promise<void> {
  const { putTokens } = await import("@/lib/session-token-store");
  return putTokens(userId, tokens);
}

async function deleteDynamoTokens(userId: string): Promise<void> {
  const { deleteTokens } = await import("@/lib/session-token-store");
  return deleteTokens(userId);
}

// Unified exports — prefer D1, fall back to DynamoDB
export async function getTokens(userId: string): Promise<StoredTokens | null> {
  if (hasD1()) {
    return getTokensD1(userId);
  }
  return getDynamoTokens(userId);
}

export async function putTokens(userId: string, tokens: StoredTokens): Promise<void> {
  if (hasD1()) {
    await putTokensD1(userId, tokens);
    return;
  }
  await putDynamoTokens(userId, tokens);
}

export async function deleteTokens(userId: string): Promise<void> {
  if (hasD1()) {
    await deleteTokensD1(userId);
    return;
  }
  await deleteDynamoTokens(userId);
}

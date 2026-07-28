/**
 * CSRF protection utilities for auth forms.
 *
 * Generates and validates CSRF tokens to prevent cross-site request forgery attacks.
 * Tokens are valid for 1 hour and tied to the session/user.
 */

import { type AuthDatabase } from "./auth-d1";

// Token expiry: 1 hour in seconds
const CSRF_TOKEN_EXPIRY_SECONDS = 60 * 60;

/**
 * Generate a new CSRF token tied to a session.
 * Uses cryptographically secure random values.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Store CSRF token in the database with expiration.
 */
export async function storeCsrfToken(
  db: AuthDatabase,
  sessionId: string,
  token: string
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + CSRF_TOKEN_EXPIRY_SECONDS;

  await db
    .prepare("INSERT OR REPLACE INTO csrf_token (id, session_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, sessionId, expiresAt)
    .run();
}

/**
 * Validate and consume a CSRF token.
 * Returns true if valid, false otherwise.
 */
export async function validateCsrfToken(
  db: AuthDatabase,
  token: string,
  sessionId?: string
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  // Build query with optional session filter
  const query = sessionId
    ? "SELECT session_id FROM csrf_token WHERE id = ? AND expires_at > ? AND session_id = ?"
    : "SELECT session_id FROM csrf_token WHERE id = ? AND expires_at > ?";

  const stmt = db.prepare(query);
  const params = sessionId ? [token, now, sessionId] : [token, now];

  const result = await stmt.bind(...params).first<{ session_id: string }>();

  if (!result) {
    return false;
  }

  return true;
}

/**
 * Delete a CSRF token (single-use or cleanup).
 */
export async function deleteCsrfToken(db: AuthDatabase, token: string): Promise<void> {
  await db.prepare("DELETE FROM csrf_token WHERE id = ?").bind(token).run();
}

/**
 * Clean up expired CSRF tokens (can be called from maintenance cron).
 */
export async function cleanupExpiredCsrfTokens(db: AuthDatabase): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare("DELETE FROM csrf_token WHERE expires_at < ?").bind(now).run();
  return result.meta?.changes ?? 0;
}

/**
 * Interface for D1 database prepared statement execution
 */
interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>(col?: string) => Promise<T | null>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
}

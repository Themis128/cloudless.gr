/**
 * D1-based email suppression list — Cloudflare Workers migration path.
 *
 * Application-level suppression in D1. Cloudflare Email Service has no native
 * suppression list API, so we manage suppression at the application layer.
 *
 * Used by subscribe/unsubscribe routes for newsletter suppression management.
 */

import type { AuthDatabase } from "@/lib/auth-d1";

const TTL_DAYS = 365 * 5; // 5 years retention (typical for suppression lists)

interface WorkersGlobal {
  __AUTH_DB__?: AuthDatabase;
}

interface ProcessWithAuthDb {
  env?: { AUTH_DB?: AuthDatabase };
}

function workersGlobal(): WorkersGlobal {
  return globalThis as unknown as WorkersGlobal;
}

function getProcessEnv(): ProcessWithAuthDb["env"] {
  return (process as unknown as ProcessWithAuthDb).env;
}

function getD1Binding(): AuthDatabase | null {
  const db = getProcessEnv()?.AUTH_DB ?? workersGlobal().__AUTH_DB__;
  if (db && typeof db.prepare === "function") return db;
  return null;
}

/**
 * Add an email address to the application-level suppression list.
 * Once suppressed, emails will not be sent to this address.
 * Returns true on success, false on failure.
 */
export async function addToSuppressionList(email: string): Promise<boolean> {
  const db = getD1Binding();
  if (!db) {
    console.warn("[ses-suppression-d1] AUTH_DB not bound — cannot suppress email");
    return false;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TTL_DAYS * 86400;

    await db
      .prepare(
        `INSERT INTO email_suppression (email, reason, suppressed_at, expires_at)
         VALUES (?, 'unsubscribe', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           reason = excluded.reason,
           suppressed_at = excluded.suppressed_at,
           expires_at = excluded.expires_at`
      )
      .bind(email, now, expiresAt)
      .run();

    return true;
  } catch (err) {
    console.error(
      "[ses-suppression-d1] Failed to suppress email:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Remove an email address from the suppression list.
 * Used when a user re-subscribes to receive emails again.
 * Returns true on success (including when email wasn't suppressed).
 */
export async function removeFromSuppressionList(email: string): Promise<boolean> {
  const db = getD1Binding();
  if (!db) {
    console.warn("[ses-suppression-d1] AUTH_DB not bound — cannot remove suppression");
    return false;
  }

  try {
    await db.prepare("DELETE FROM email_suppression WHERE email = ?").bind(email).run();
    return true;
  } catch (err) {
    console.error(
      "[ses-suppression-d1] Failed to remove suppression:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Check if an email is on the suppression list.
 * Used before attempting to send emails to check if address should be skipped.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const db = getD1Binding();
  if (!db) {
    return false;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const row = await db
      .prepare("SELECT 1 FROM email_suppression WHERE email = ? AND expires_at > ?")
      .bind(email, now)
      .first();

    return !!row;
  } catch {
    return false;
  }
}

/**
 * Get all suppressed emails for bulk cleanup or export.
 * Returns emails that haven't expired yet.
 */
export async function getSuppressedEmails(limit = 1000): Promise<string[]> {
  const db = getD1Binding();
  if (!db) {
    return [];
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const rows = await db
      .prepare(
        "SELECT email FROM email_suppression WHERE expires_at > ? ORDER BY suppressed_at DESC LIMIT ?"
      )
      .bind(now, limit)
      .all<{ email: string }>();

    return rows.results.map((r: { email: string }) => r.email);
  } catch {
    return [];
  }
}

/**
 * Set suppression status at the module level (for testing).
 */
export function setD1Binding(db: AuthDatabase | null): void {
  if (db) {
    const env = getProcessEnv() ?? {};
    env.AUTH_DB = db;
    (process as unknown as ProcessWithAuthDb).env = env;
  }
}

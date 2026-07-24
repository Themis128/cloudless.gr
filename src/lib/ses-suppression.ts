/**
 * Email suppression list management — D1 primary.
 *
 * In Cloudflare Workers: uses D1 email_suppression table.
 * AWS SES fallback has been removed as part of migration to Cloudflare.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
 */

import type { AuthDatabase } from "@/lib/auth-d1";

// Lazy load D1 helper to avoid circular imports
function getD1Binding(): AuthDatabase | null {
  const db = (process as any).env?.AUTH_DB || (globalThis as any).__AUTH_DB__;
  if (db && typeof db.prepare === "function") return db as AuthDatabase;
  return null;
}

// Detect if running in Cloudflare Workers
function isWorkers(): boolean {
  return typeof (globalThis as any).caches !== "undefined" && typeof process === "undefined";
}

// D1 suppression operations
async function addToSuppressionListD1(email: string): Promise<boolean> {
  const db = getD1Binding();
  if (!db) return false;

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 5 * 365 * 86400; // 5 years

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
    console.warn("[ses-suppression] D1 suppress failed:", err);
    return false;
  }
}

async function removeFromSuppressionListD1(email: string): Promise<boolean> {
  const db = getD1Binding();
  if (!db) return false;

  try {
    await db.prepare("DELETE FROM email_suppression WHERE email = ?").bind(email).run();
    return true;
  } catch (err) {
    console.warn("[ses-suppression] D1 unsuppress failed:", err);
    return false;
  }
}

/**
 * Add an email address to the suppression list.
 * In Workers: uses D1 email_suppression table.
 *
 * Returns true on success, false on failure (logged, not thrown).
 */
export async function addToSuppressionList(email: string): Promise<boolean> {
  // We are only using D1 now
  return addToSuppressionListD1(email);
}

/**
 * Remove an email address from the suppression list, so a
 * re-subscribing user can receive email again.
 *
 * Returns true on success (including when email wasn't suppressed),
 * false on failure (logged, not thrown).
 */
export async function removeFromSuppressionList(email: string): Promise<boolean> {
  // We are only using D1 now
  return removeFromSuppressionListD1(email);
}
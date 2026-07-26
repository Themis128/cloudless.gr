/**
 * Email suppression list management — D1 primary.
 *
 * In Cloudflare Workers: uses D1 email_suppression table.
 * AWS SES fallback has been removed as part of migration to Cloudflare.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
 */

import {
  SESv2Client,
  PutSuppressedDestinationCommand,
  DeleteSuppressedDestinationCommand,
} from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";

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
 * Domain portion of an email, reduced to an allowlisted [a-z0-9.-] slug for
 * safe logging. Anything outside the allowlist (including CR/LF used in log
 * forging) is dropped so the value cannot inject log entries or control
 * sequences.
 */
function logSafeDomain(email: string): string {
  const raw = email.includes("@") ? email.split("@")[1] : "";
  const slug = raw.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  return slug.slice(0, 253) || "(no-domain)";
}

/** Reduce an arbitrary error message to a printable-ASCII single line. */
function logSafeMessage(err: unknown): string {
  const raw = (err as Error)?.message ?? "unknown error";
  return raw.replace(/[^\x20-\x7E]/g, " ").slice(0, 200);
}

/**
 * Add an email address to the SES account-level suppression list.
 * Once suppressed, SES will reject any future sends to this address.
 *
 * Returns true on success, false on failure (logged, not thrown).
 */
export async function addToSuppressionList(email: string): Promise<boolean> {
  try {
    const client = await getSESv2();
    await client.send(
      new PutSuppressedDestinationCommand({
        EmailAddress: email,
        Reason: "COMPLAINT",
      })
    );
    const safeDomain = logSafeDomain(email);
    console.warn(`[SES] Added to suppression list: *@${safeDomain}`);
    return true;
  } catch (err) {
    const safeDomain = logSafeDomain(email);
    const msg = logSafeMessage(err);
    console.error(`[SES] Failed to suppress *@${safeDomain}: ${msg}`);
    return false;
  }
}

/**
 * Remove an email address from the SES account-level suppression list, so a
 * re-subscribing user can receive email again. A "not suppressed" result
 * counts as success. Returns true on success, false on failure (logged,
 * not thrown).
 */
export async function removeFromSuppressionList(email: string): Promise<boolean> {
  try {
    const client = await getSESv2();
    await client.send(new DeleteSuppressedDestinationCommand({ EmailAddress: email }));
    const safeDomain = logSafeDomain(email);
    console.warn(`[SES] Removed from suppression list: *@${safeDomain}`);
    return true;
  } catch (err) {
    // SES throws NotFoundException when the address was never suppressed;
    // for a brand-new subscriber that is the normal case, treat as success.
    if ((err as { name?: string })?.name === "NotFoundException") return true;
    const safeDomain = logSafeDomain(email);
    const msg = logSafeMessage(err);
    console.error(`[SES] Failed to remove *@${safeDomain} from suppression: ${msg}`);
    return false;
  }
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
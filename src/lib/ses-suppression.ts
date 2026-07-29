/**
 * Email suppression list management — D1 primary.
 *
 * In Cloudflare Workers: uses D1 email_suppression table.
 * AWS SES fallback has been removed as part of migration to Cloudflare.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
 */

import {
  PutSuppressedDestinationCommand,
  DeleteSuppressedDestinationCommand,
} from "@aws-sdk/client-sesv2";

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

async function getSESv2() {
  const { SESv2Client } = await import("@aws-sdk/client-sesv2");
  const { getConfig } = await import("@/lib/ssm-config");
  const cfg = await getConfig();
  return new SESv2Client({ region: cfg.AWS_SES_REGION || "us-east-1" });
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

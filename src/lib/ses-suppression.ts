/**
 * SES account-level suppression list management.
 *
 * Uses the SESv2 PutSuppressedDestination API to prevent future emails
 * to unsubscribed addresses. This is the AWS-recommended approach for
 * managing email opt-outs without a third-party mailing list service.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
 */

import {
  SESv2Client,
  PutSuppressedDestinationCommand,
  DeleteSuppressedDestinationCommand,
} from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";

let sesv2Client: SESv2Client | null = null;

async function getSESv2(): Promise<SESv2Client> {
  if (sesv2Client) return sesv2Client;
  const config = await getConfig();
  sesv2Client = new SESv2Client({ region: config.AWS_SES_REGION });
  return sesv2Client;
}

/** Domain portion of an email, newline-stripped, for safe logging. */
function logSafeDomain(email: string): string {
  return (email.includes("@") ? email.split("@")[1] : "(no-domain)").replace(/[\r\n]/g, "_");
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
    console.warn(`[SES] Added to suppression list: *@${safeDomain}`); // codeql[js/log-injection]
    return true;
  } catch (err) {
    const safeDomain = logSafeDomain(email);
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error(`[SES] Failed to suppress *@${safeDomain}:`, msg); // codeql[js/log-injection] codeql[js/tainted-format-string]
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
    console.warn(`[SES] Removed from suppression list: *@${safeDomain}`); // codeql[js/log-injection]
    return true;
  } catch (err) {
    // SES throws NotFoundException when the address was never suppressed;
    // for a brand-new subscriber that is the normal case, treat as success.
    if ((err as { name?: string })?.name === "NotFoundException") return true;
    const safeDomain = logSafeDomain(email);
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error(`[SES] Failed to remove *@${safeDomain} from suppression:`, msg); // codeql[js/log-injection] codeql[js/tainted-format-string]
    return false;
  }
}

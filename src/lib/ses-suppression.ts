/**
 * SES account-level suppression list management.
 *
 * Uses the SESv2 PutSuppressedDestination API to prevent future emails
 * to unsubscribed addresses. This is the AWS-recommended approach for
 * managing email opt-outs without a third-party mailing list service.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
 */

import { SESv2Client, PutSuppressedDestinationCommand } from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";

let sesv2Client: SESv2Client | null = null;

async function getSESv2(): Promise<SESv2Client> {
  if (sesv2Client) return sesv2Client;
  const config = await getConfig();
  sesv2Client = new SESv2Client({ region: config.AWS_SES_REGION });
  return sesv2Client;
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
      }),
    );
    console.warn(`[SES] Added to suppression list: ${email}`);
    return true;
  } catch (err) {
    console.error(`[SES] Failed to suppress ${email}:`, err);
    return false;
  }
}

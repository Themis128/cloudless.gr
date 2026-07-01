/**
 * SNS notification publisher for portal events.
 *
 * Publishes structured JSON messages to the `SNS_PORTAL_TOPIC_ARN` topic
 * (configured in SSM). The topic fans out to:
 *   1. Email subscription → team gets notified
 *   2. Lambda subscription → posts to Slack
 *
 * Gracefully no-ops when the topic ARN is not configured (SSM key missing).
 * All publishes are fire-and-forget — never block the caller.
 */
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { getConfig } from "@/lib/ssm-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PortalEventType =
  | "comment_added"       // Client posted a comment on a step
  | "deliverable_action"  // Client approved / requested changes on a deliverable
  | "step_updated"        // (reserved) Admin updates a step status
  | "portal_created";     // (reserved) New portal approved

export interface PortalEventPayload {
  eventType: PortalEventType;
  portalLabel: string;
  clientName: string;
  clientEmail: string;
  /** Human-readable one-liner used as the SNS Subject (email subject line). */
  title: string;
  /** Detailed markdown text for the Slack integration. */
  description: string;
  /** Optional deep-link to the portal or admin page. */
  url?: string;
  /** Extra metadata for downstream consumers (Lambda, SQS). */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SNS client (lazy singleton — reuses the connection pool)
// ---------------------------------------------------------------------------

let snsClient: SNSClient | null = null;

function getSNS(): SNSClient {
  if (!snsClient) snsClient = new SNSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  return snsClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Publish a portal notification event to the SNS topic.
 * Returns true when published, false when the topic ARN is not configured
 * (silent skip — the caller should not treat this as an error).
 */
export async function publishPortalNotification(
  payload: PortalEventPayload
): Promise<boolean> {
  let topicArn: string;
  try {
    const cfg = await getConfig();
    topicArn = cfg.SNS_PORTAL_TOPIC_ARN;
  } catch {
    return false;
  }
  if (!topicArn) return false;

  const message = JSON.stringify(payload);

  try {
    await getSNS().send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: payload.title.slice(0, 100), // SNS Subject limit
        Message: message,
        MessageAttributes: {
          eventType: {
            DataType: "String",
            StringValue: payload.eventType,
          },
          portalLabel: {
            DataType: "String",
            StringValue: payload.portalLabel.slice(0, 80),
          },
        },
      })
    );
    return true;
  } catch (err) {
    console.error("[SNS] Failed to publish portal notification:", err);
    return false;
  }
}

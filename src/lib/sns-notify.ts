/**
 * SNS notification publisher for portal events — REMOVED (Wave A cutover).
 *
 * Portal notifications should use Slack (@/lib/slack-notify) or ntfy directly.
 * This module retains types and a no-op publish function for transitional imports.
 */

export type PortalEventType =
  "comment_added" | "deliverable_action" | "step_updated" | "portal_created";

export interface PortalEventPayload {
  eventType: PortalEventType;
  portalLabel: string;
  clientName: string;
  clientEmail: string;
  title: string;
  description: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * No-op — AWS SNS removed. Returns false (topic not configured).
 */
export async function publishPortalNotification(_payload: PortalEventPayload): Promise<boolean> {
  return false;
}

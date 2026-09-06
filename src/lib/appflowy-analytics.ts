/**
 * AppFlowy Analytics — event tracking for AppFlowy.
 *
 * Lightweight event tracker that stores events as Documents in AppFlowy.
 * Falls back to no-op when AppFlowy is not configured.
 */

import { isAppFlowyConfigured } from "./appflowy";

export type AnalyticsEventType =
  | "page_view"
  | "blog_view"
  | "doc_view"
  | "service_view"
  | "case_study_view"
  | "faq_view"
  | "contact_submit"
  | "newsletter_signup"
  | "checkout_start"
  | "checkout_complete"
  | "button_click"
  | "search_query";

export interface AnalyticsEvent {
  event: AnalyticsEventType;
  path?: string;
  referrer?: string;
  userAgent?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Track an analytics event by creating a Document in AppFlowy.
 * Returns true on success (or if not configured), false on failure.
 */
export async function trackEvent(event: Omit<AnalyticsEvent, "timestamp">): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return true; // No-op when not configured

  try {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // AppFlowy write API not yet implemented
    console.warn("[AppFlowy Analytics] Would track event:", fullEvent.event, fullEvent.path || "");
    return true;
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Analytics] Failed to track event:", msg);
    return false;
  }
}

/**
 * Get analytics summary for the admin dashboard.
 * Returns mock data when not configured.
 */
export async function getAnalyticsSummary(_days = 7): Promise<{
  totalEvents: number;
  uniqueVisitors: number;
  topPages: Array<{ path: string; views: number }>;
  eventsByType: Record<string, number>;
}> {
  if (!(await isAppFlowyConfigured())) {
    return {
      totalEvents: 0,
      uniqueVisitors: 0,
      topPages: [],
      eventsByType: {},
    };
  }

  // AppFlowy read API would query events here
  // For now return empty
  return {
    totalEvents: 0,
    uniqueVisitors: 0,
    topPages: [],
    eventsByType: {},
  };
}

/**
 * Create a weekly rollup of analytics events.
 * This is called by a cron job.
 */
export async function createWeeklyRollup(): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return true;
  console.warn("[AppFlowy Analytics] Would create weekly rollup");
  return true;
}

/**
 * Archive old analytics events.
 * This is called by a cron job.
 */
export async function archiveOldEvents(olderThanDays = 90): Promise<number> {
  if (!(await isAppFlowyConfigured())) return 0;
  console.warn("[AppFlowy Analytics] Would archive events older than", olderThanDays, "days");
  return 0;
}

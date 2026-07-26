import { getIntegrationsAsync } from "@/lib/integrations";
import {
  notionGetCalendarItems,
  notionCreateCalendarItem,
  notionUpdateCalendarItem,
  notionDeleteCalendarItem,
} from "@/lib/notion-calendar";

export type CalendarItemType =
  | "social_post"
  | "email_campaign"
  | "blog_post"
  | "consultation"
  | "ad_campaign";

export type CalendarPlatform =
  | "meta"
  | "linkedin"
  | "tiktok"
  | "x"
  | "google"
  | "activecampaign"
  | "notion"
  | "google_calendar";

export interface CalendarItem {
  id: string;
  title: string;
  type: CalendarItemType;
  platform: CalendarPlatform;
  date: string;
  endDate?: string;
  status: "draft" | "scheduled" | "published" | "cancelled";
  url?: string;
  notes?: string;
  /**
   * Postiz post IDs returned when a `social_post` item is published. Stored so
   * the postiz-sync cron and the webhook receiver can match upstream
   * post.published / post.errored events back to the calendar row that
   * created them. One ID per channel the item fanned out to.
   */
  postizPostIds?: string[];
  /**
   * Workspace id (multi-tenant). When set, queries that supply a workspace
   * filter will only return items whose `workspaceId` matches. New items
   * created via the calendar API are stamped with the active workspace
   * (cookie-derived) when one is selected. Items without a workspaceId are
   * treated as "org-wide" and remain visible regardless of which workspace
   * is active — protecting all the legacy rows that pre-date this column.
   */
  workspaceId?: string;
}

export const CALENDAR_ITEM_COLORS: Record<CalendarItemType, string> = {
  social_post: "#e879f9",
  email_campaign: "#a855f7",
  blog_post: "#22d3ee",
  consultation: "#4ade80",
  ad_campaign: "#fb923c",
};

export const PLATFORM_LABELS: Record<CalendarPlatform, string> = {
  meta: "Meta",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  google: "Google Ads",
  activecampaign: "Email",
  notion: "Blog",
  google_calendar: "Calendar",
};

// In-process fallback store. Used when NOTION_API_KEY / NOTION_CALENDAR_DB_ID
// are not configured (typically local dev) so the calendar UI is exercisable
// without a Notion workspace. Resets on every cold start; not durable.
let store: CalendarItem[] = [];

async function notionEnabled(): Promise<boolean> {
  const cfg = await getIntegrationsAsync();
  return !!(cfg.NOTION_API_KEY && cfg.NOTION_CALENDAR_DB_ID);
}

export async function getCalendarItems(
  from?: string,
  to?: string,
  options?: { workspaceId?: string | null }
): Promise<CalendarItem[]> {
  const all = await readAllItems(from, to);
  const ws = options?.workspaceId;
  if (!ws) return all;
  // Items without a workspaceId are org-wide and remain visible regardless
  // of which workspace is active.
  return all.filter((i) => !i.workspaceId || i.workspaceId === ws);
}

async function readAllItems(from?: string, to?: string): Promise<CalendarItem[]> {
  if (await notionEnabled()) {
    return (await notionGetCalendarItems(from, to)) ?? [];
  }
  if (!from && !to) return store;
  return store.filter((item) => {
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });
}

export async function createCalendarItem(input: Omit<CalendarItem, "id">): Promise<CalendarItem> {
  const item: CalendarItem = {
    ...input,
    id: `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  if (await notionEnabled()) {
    await notionCreateCalendarItem(item);
  } else {
    store.push(item);
  }
  return item;
}

export async function updateCalendarItem(
  id: string,
  updates: Partial<Omit<CalendarItem, "id">>
): Promise<CalendarItem | null> {
  if (await notionEnabled()) {
    const all = (await notionGetCalendarItems()) ?? [];
    const existing = all.find((i) => i.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await notionUpdateCalendarItem(updated);
    return updated;
  }
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export async function deleteCalendarItem(id: string): Promise<boolean> {
  if (await notionEnabled()) {
    return notionDeleteCalendarItem(id);
  }
  const len = store.length;
  store = store.filter((i) => i.id !== id);
  return store.length < len;
}

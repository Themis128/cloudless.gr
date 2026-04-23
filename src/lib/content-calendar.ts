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

let store: CalendarItem[] = [];

export function getCalendarItems(
  from?: string,
  to?: string,
): CalendarItem[] {
  if (!from && !to) return store;
  return store.filter((item) => {
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });
}

export function createCalendarItem(
  input: Omit<CalendarItem, "id">,
): CalendarItem {
  const item: CalendarItem = {
    ...input,
    id: `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  store.push(item);
  return item;
}

export function updateCalendarItem(
  id: string,
  updates: Partial<Omit<CalendarItem, "id">>,
): CalendarItem | null {
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export function deleteCalendarItem(id: string): boolean {
  const len = store.length;
  store = store.filter((i) => i.id !== id);
  return store.length < len;
}

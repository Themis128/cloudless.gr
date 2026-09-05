import type { CalendarItem, CalendarItemType, CalendarPlatform } from "./calendar-shared";
import { getUpcomingConsultations } from "./google-calendar";

export type { CalendarItem, CalendarItemType, CalendarPlatform };
export { CALENDAR_ITEM_COLORS, PLATFORM_LABELS } from "./calendar-shared";

// In-process store. Calendar no longer falls through to Notion.
// Resets on every cold start; not durable. Postiz is the social scheduler.
let store: CalendarItem[] = [];

// GCal consultation cache — refreshed at most every 5 minutes.
const GCAL_CACHE_TTL_MS = 5 * 60 * 1000;
let gcalCache: { items: CalendarItem[]; expiry: number } | null = null;

/** Force the next readAllItems call to re-fetch from Google Calendar. */
export function invalidateConsultationCache(): void {
  gcalCache = null;
}

async function fetchGCalConsultations(): Promise<CalendarItem[]> {
  const now = Date.now();
  if (gcalCache && now < gcalCache.expiry) return gcalCache.items;
  try {
    const consultations = await getUpcomingConsultations();
    const items: CalendarItem[] = consultations.map((c) => ({
      id: `gcal_${c.id}`,
      title: c.title,
      type: "consultation" as CalendarItemType,
      platform: "google_calendar" as CalendarPlatform,
      date: c.start,
      endDate: c.end,
      status: c.status === "upcoming" ? "scheduled" : "published",
      url: c.meetLink,
    }));
    gcalCache = { items, expiry: now + GCAL_CACHE_TTL_MS };
    return items;
  } catch {
    // Keep stale cache on error rather than returning nothing.
    return gcalCache?.items ?? [];
  }
}

function newCalendarItemId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `cal_${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return `cal_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  return `cal_${Date.now()}`;
}

export async function getCalendarItems(
  from?: string,
  to?: string,
  options?: { workspaceId?: string | null }
): Promise<CalendarItem[]> {
  const all = await readAllItems(from, to);
  const ws = options?.workspaceId;
  if (!ws) return all;
  return all.filter((i) => !i.workspaceId || i.workspaceId === ws);
}

async function readAllItems(from?: string, to?: string): Promise<CalendarItem[]> {
  const gcalItems = await fetchGCalConsultations();
  const all = [...store, ...gcalItems];
  if (!from && !to) return all;
  return all.filter((item) => {
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });
}

export async function createCalendarItem(input: Omit<CalendarItem, "id">): Promise<CalendarItem> {
  const item: CalendarItem = {
    ...input,
    id: newCalendarItemId(),
  };
  store.push(item);
  return item;
}

export async function updateCalendarItem(
  id: string,
  updates: Partial<Omit<CalendarItem, "id">>
): Promise<CalendarItem | null> {
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export async function deleteCalendarItem(id: string): Promise<boolean> {
  const len = store.length;
  store = store.filter((i) => i.id !== id);
  return store.length < len;
}

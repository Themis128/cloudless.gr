import type { CalendarItem, CalendarItemType, CalendarPlatform } from "./calendar-shared";

export type { CalendarItem, CalendarItemType, CalendarPlatform };
export { CALENDAR_ITEM_COLORS, PLATFORM_LABELS } from "./calendar-shared";

// In-process store. Calendar no longer falls through to Notion.
// Resets on every cold start; not durable. Postiz is the social scheduler.
let store: CalendarItem[] = [];

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

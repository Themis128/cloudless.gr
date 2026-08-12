/**
 * Shared helpers for 30-minute consultation slots.
 *
 * Used by the chat agent's book_slot tool (src/lib/chat-tools.ts) and the
 * authenticated booking agent (src/lib/agent-book.ts) so both render slot
 * labels and clamp `days_ahead` identically.
 */

import { APP_TIMEZONE } from "@/lib/timezone";

export const MIN_DAYS_AHEAD = 1;
export const MAX_DAYS_AHEAD = 14;
export const DEFAULT_DAYS_AHEAD = 7;

const TWO_DIGIT = "2-digit" as const;

const ATHENS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: TWO_DIGIT,
  minute: TWO_DIGIT,
  hour12: false,
};

const ATHENS_TIME_ONLY_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  hour: TWO_DIGIT,
  minute: TWO_DIGIT,
  hour12: false,
};

/**
 * Format a slot as e.g. "Tue Aug 12 10:00–10:30 Athens".
 */
export function formatAthensSlot(start: string, end: string): string {
  const startStr = new Date(start).toLocaleString("en-IE", ATHENS_DATE_FORMAT);
  const endStr = new Date(end).toLocaleTimeString("en-IE", ATHENS_TIME_ONLY_FORMAT);
  return `${startStr}–${endStr} Athens`;
}

/**
 * Coerce arbitrary input to a valid days-ahead window
 * (between MIN_DAYS_AHEAD and MAX_DAYS_AHEAD).
 */
export function clampDaysAhead(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_DAYS_AHEAD;
  return Math.max(MIN_DAYS_AHEAD, Math.min(MAX_DAYS_AHEAD, Math.trunc(n)));
}

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

const ATHENS_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
};

/**
 * Format a slot as e.g. "Tue Aug 12 10:00–10:30 Athens".
 */
export function formatAthensSlot(start: string, end: string): string {
  const startStr = new Date(start).toLocaleString("en-IE", ATHENS_DATE_FORMAT);
  const endStr = new Date(end).toLocaleTimeString("en-IE", ATHENS_TIME_ONLY_FORMAT);
  return `${startStr}–${endStr} Athens`;
}

/** Day label only, e.g. "Fri, 28 Aug". */
export function formatAthensSlotDay(start: string): string {
  return new Date(start).toLocaleDateString("en-IE", ATHENS_DAY_FORMAT);
}

/** Time range only, e.g. "09:00–09:30". */
export function formatAthensSlotTimeRange(start: string, end: string): string {
  const startTime = new Date(start).toLocaleTimeString("en-IE", ATHENS_TIME_ONLY_FORMAT);
  const endTime = new Date(end).toLocaleTimeString("en-IE", ATHENS_TIME_ONLY_FORMAT);
  return `${startTime}–${endTime}`;
}

/**
 * Markdown table of slots for chat (Day | Time). Includes a machine-readable
 * footer with ISO start/end so book_slot can use exact values.
 */
export function formatAthensSlotsTable(
  slots: { start: string; end: string }[],
  options?: { includeRefs?: boolean }
): string {
  const includeRefs = options?.includeRefs !== false;
  const header = "| # | Day | Time (Athens) |\n| --- | --- | --- |";
  const rows = slots.map((s, i) => {
    const n = i + 1;
    const day = formatAthensSlotDay(s.start);
    const time = formatAthensSlotTimeRange(s.start, s.end);
    return `| ${n} | ${day} | ${time} |`;
  });
  const table = [header, ...rows].join("\n");
  if (!includeRefs) return table;
  const refs = slots.map((s, i) => `${i + 1}. start=${s.start} end=${s.end}`).join("\n");
  return `${table}\n\nSlot refs (use exact ISO values for book_slot):\n${refs}`;
}

/**
 * Coerce arbitrary input to a valid days-ahead window
 * (between MIN_DAYS_AHEAD and MAX_DAYS_AHEAD).
 */
export function clampDaysAhead(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_DAYS_AHEAD;
  return Math.max(MIN_DAYS_AHEAD, Math.min(MAX_DAYS_AHEAD, Math.trunc(n)));
}

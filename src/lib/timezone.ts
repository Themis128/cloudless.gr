/**
 * Canonical app timezone — cloudless.gr operates in Greece.
 *
 * Use these helpers (or `APP_TIMEZONE` in Intl options) for any user-visible
 * date/time. Storage/APIs may still use ISO-8601 UTC instants; display is Athens.
 */
import { DEFAULT_TIMEZONE } from "@/lib/locale-defaults";

export const APP_TIMEZONE = DEFAULT_TIMEZONE;

const DEFAULT_LOCALE = "en-IE";

function asDate(input: string | number | Date): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date+time in Europe/Athens (e.g. admin timestamps). */
export function formatAppDateTime(
  input: string | number | Date,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = asDate(input);
  if (!d) return "—";
  return d.toLocaleString(locale, {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  });
}

/** Calendar date in Europe/Athens. */
export function formatAppDate(
  input: string | number | Date,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = asDate(input);
  if (!d) return "—";
  return d.toLocaleDateString(locale, {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/** Clock time in Europe/Athens (24h). */
export function formatAppTime(
  input: string | number | Date,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = asDate(input);
  if (!d) return "—";
  return d.toLocaleTimeString(locale, {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options,
  });
}

/** YYYY-MM-DD for “today” in Europe/Athens (not UTC). */
export function appTodayIsoDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

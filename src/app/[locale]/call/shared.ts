import type { Metadata } from "next";
import { getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";

export const TALK_CALL_BASE = "https://cloud.cloudless.gr/call";
export const CONSULT_ROOM_TOKEN = "3294636523";

// Talk room tokens are [a-z0-9]{4,30}; anything else is not a room.
const TOKEN_RE = /^[a-z0-9]{4,30}$/;

// Vanity slugs that resolve to a named Talk room instead of a raw token.
const CALL_ALIASES: Record<string, string> = {
  consult: CONSULT_ROOM_TOKEN,
  video: CONSULT_ROOM_TOKEN,
};

export function resolveCallToken(token: string): string | null {
  if (Object.hasOwn(CALL_ALIASES, token)) return CALL_ALIASES[token];
  return TOKEN_RE.test(token) ? token : null;
}

export function callMetadata(locale: string): Metadata {
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  const messages = getMessages(safeLocale);
  const meta = (messages as Record<string, unknown>).meta as
    Record<string, Record<string, string>> | undefined;
  return {
    title: meta?.call?.title ?? "Join the call — Cloudless",
    description: meta?.call?.description ?? "Forwarding you to the Nextcloud Talk call.",
    robots: { index: false, follow: false },
  };
}

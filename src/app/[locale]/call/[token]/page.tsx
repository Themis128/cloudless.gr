export const dynamic = "force-dynamic";

import { redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";

const TALK_CALL_BASE = "https://cloud.cloudless.gr/call";
// Talk room tokens are [a-z0-9]{4,30}; anything else is not a room.
const TOKEN_RE = /^[a-z0-9]{4,30}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  const messages = getMessages(safeLocale);
  const meta = (messages as Record<string, unknown>).meta as
    Record<string, Record<string, string>> | undefined;
  return {
    title: meta?.call?.title ?? "Join the call — Cloudless",
    description:
      meta?.call?.description ?? "Forwarding you to the Nextcloud Talk call.",
    robots: { index: false, follow: false },
  };
}

export default async function CallRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  if (TOKEN_RE.test(token)) {
    nextRedirect(`${TALK_CALL_BASE}/${token}`);
  }
  redirect({ href: "/consultation", locale: safeLocale });
}

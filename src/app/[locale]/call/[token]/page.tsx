export const dynamic = "force-dynamic";

import { redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import type { Metadata } from "next";
import { isSupportedLocale, type Locale } from "@/lib/i18n";
import { TALK_CALL_BASE, callMetadata, resolveCallToken } from "../shared";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return callMetadata(locale);
}

export default async function CallRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  const roomToken = resolveCallToken(token);
  if (roomToken) {
    nextRedirect(`${TALK_CALL_BASE}/${roomToken}`);
  }
  redirect({ href: "/consultation", locale: safeLocale });
}

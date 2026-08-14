"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { localeFromPathname } from "@/lib/locale-from-pathname";

/**
 * Keep `<html lang>` in sync on client-side locale switches.
 * The root layout does not re-render, and `[locale]` layout props can stay
 * stale across next-intl `router.replace(..., { locale })` navigations.
 */
export default function HtmlLangSync({ locale }: { locale?: string }) {
  const intlLocale = useLocale();
  const pathname = usePathname();

  useLayoutEffect(() => {
    const next = localeFromPathname(pathname) ?? intlLocale ?? locale ?? "en";
    if (document.documentElement.lang !== next) {
      document.documentElement.lang = next;
    }
  }, [pathname, intlLocale, locale]);

  return null;
}

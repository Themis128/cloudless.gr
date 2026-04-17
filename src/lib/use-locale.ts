"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { type Locale, isSupportedLocale, defaultLocale } from "@/lib/i18n";

/**
 * Client-side hook for reading and switching the active locale.
 * Reads locale from NextIntlClientProvider context (set by middleware).
 * Switching locale navigates to the same path with the new locale prefix.
 *
 * Returns [currentLocale, setLocale] to preserve backwards compatibility
 * with all components that destructure the tuple.
 */
export function useCurrentLocale(): [Locale, (locale: Locale) => void] {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const setLocale = (nextLocale: Locale) => {
    router.replace(pathname, { locale: nextLocale });
  };

  return [locale, setLocale];
}

// Legacy helpers — kept for any direct imports outside of useCurrentLocale
export function readLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const cookieLocale = document.cookie
    .split("; ")
    .find((e) => e.startsWith("NEXT_LOCALE="))
    ?.split("=")[1];
  return cookieLocale && isSupportedLocale(cookieLocale)
    ? (cookieLocale as Locale)
    : defaultLocale;
}

export function setAppLocale(locale: Locale): void {
  // No-op: locale switching is now URL-based via useCurrentLocale
  void locale;
}

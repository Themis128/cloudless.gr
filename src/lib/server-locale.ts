import { getLocale } from "next-intl/server";
import { defaultLocale, isSupportedLocale, type Locale } from "@/lib/i18n";

/**
 * Read the active locale in a Server Component or Server Action.
 * Delegates to next-intl which reads from the middleware-set request context.
 * Falls back to defaultLocale when context is unavailable (e.g. API routes).
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const locale = await getLocale();
    if (isSupportedLocale(locale)) return locale;
  } catch {
    // Outside next-intl middleware context (API routes, etc.)
  }
  return defaultLocale;
}

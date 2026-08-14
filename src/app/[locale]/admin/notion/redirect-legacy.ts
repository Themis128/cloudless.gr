import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

function asLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Locale-aware redirect from leftover /admin/notion* URLs to AppFlowy. */
export async function redirectLegacyNotionPage(
  params: Promise<{ locale: string }>,
  href: string
) {
  const { locale } = await params;
  redirect({ href, locale: asLocale(locale) });
}

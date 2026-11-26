import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n";

const BASE_URL = "https://cloudless.gr";

export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  el: "el_GR",
  fr: "fr_FR",
  de: "de_DE",
};

/**
 * hreflang `languages` map for a slug, derived from `routing.locales` so a
 * locale added in `src/i18n/routing.ts` propagates to every page's
 * alternates automatically instead of requiring an edit per page.
 * `slug` is the locale-less path ("services", `blog/post-slug`, "" for home).
 * `locales` narrows the map for pages routed in fewer locales (campaigns).
 */
export function languageAlternates(
  slug: string,
  locales: readonly string[] = routing.locales
): Record<string, string> {
  const suffix = slug ? `/${slug}` : "";
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${BASE_URL}/${locale}${suffix}`;
  }
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${suffix}`;
  return languages;
}

/**
 * Open Graph locale pair for a page: `og:locale` plus `og:locale:alternate`
 * for every other routed locale. Page-level openGraph objects REPLACE the
 * layout's object (Next.js does not merge OG fields), so every page that
 * declares openGraph must re-declare locale or shares drop og:locale.
 */
export function ogLocales(
  locale: Locale,
  locales: readonly string[] = routing.locales
): { locale: string; alternateLocale: string[] } {
  return {
    locale: OG_LOCALE[locale],
    alternateLocale: locales
      .filter((l) => l !== locale)
      .map((l) => OG_LOCALE[l as Locale])
      .filter(Boolean),
  };
}

/**
 * Complete SEO metadata for a [locale] page: title/description, a per-locale
 * canonical (bare /slug canonicals mark every locale page as a duplicate of
 * the /en redirect target), the full hreflang map, and an openGraph object
 * carrying url + og:locale/alternateLocale so social shares of el/fr/de
 * pages keep their locale. `openGraph` extras (type:"article",
 * publishedTime, images) merge over the defaults.
 */
export function localizedPageMetadata({
  locale,
  slug = "",
  title,
  description,
  openGraph,
  locales,
  untranslatedContent = false,
}: {
  locale: Locale;
  slug?: string;
  title: string;
  description?: string;
  openGraph?: Record<string, unknown>;
  locales?: readonly string[];
  /**
   * Set when the page body is identical across locales (slug/id detail pages
   * that load the same English content record regardless of prefix). These
   * must not advertise hreflang "translations" — crawlers would follow links
   * to untranslated copies. They still get a self-referencing canonical.
   */
  untranslatedContent?: boolean;
}): Metadata {
  const canonical = `${BASE_URL}/${locale}${slug ? `/${slug}` : ""}`;
  return {
    title,
    description,
    alternates: untranslatedContent
      ? { canonical }
      : { canonical, languages: languageAlternates(slug, locales) },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "Cloudless",
      ...ogLocales(locale, locales),
      ...openGraph,
    },
  };
}

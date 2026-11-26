import { describe, it, expect } from "vitest";
import { languageAlternates, ogLocales, localizedPageMetadata, OG_LOCALE } from "@/lib/seo-metadata";
import { routing } from "@/i18n/routing";

describe("languageAlternates", () => {
  it("emits one entry per routed locale plus x-default", () => {
    const langs = languageAlternates("services");
    for (const locale of routing.locales) {
      expect(langs[locale]).toBe(`https://cloudless.gr/${locale}/services`);
    }
    expect(langs["x-default"]).toBe(`https://cloudless.gr/${routing.defaultLocale}/services`);
    expect(Object.keys(langs).sort()).toEqual([...routing.locales, "x-default"].sort());
  });

  it("produces root URLs for an empty slug", () => {
    expect(languageAlternates("").en).toBe("https://cloudless.gr/en");
  });

  it("respects a narrowed locale set", () => {
    const langs = languageAlternates("campaigns/x", ["en", "el"]);
    expect(Object.keys(langs).sort()).toEqual(["el", "en", "x-default"]);
  });
});

describe("ogLocales", () => {
  it("maps every routed locale to an og locale and lists the rest as alternates", () => {
    for (const locale of routing.locales) {
      const { locale: og, alternateLocale } = ogLocales(locale);
      expect(og).toBe(OG_LOCALE[locale]);
      expect(alternateLocale).toHaveLength(routing.locales.length - 1);
      expect(alternateLocale).not.toContain(OG_LOCALE[locale]);
    }
  });
});

describe("localizedPageMetadata", () => {
  it("emits a per-locale canonical, matching og:url, and og:locale", () => {
    const md = localizedPageMetadata({
      locale: "el",
      slug: "services",
      title: "T",
      description: "D",
    });
    expect(md.alternates?.canonical).toBe("https://cloudless.gr/el/services");
    expect(md.openGraph && (md.openGraph as Record<string, unknown>).url).toBe(
      "https://cloudless.gr/el/services"
    );
    expect(md.openGraph && (md.openGraph as Record<string, unknown>).locale).toBe("el_GR");
    expect(md.openGraph && (md.openGraph as Record<string, unknown>).alternateLocale).toEqual([
      "en_US",
      "fr_FR",
      "de_DE",
    ]);
  });

  it("merges openGraph extras over the defaults", () => {
    const md = localizedPageMetadata({
      locale: "en",
      slug: "blog/post",
      title: "T",
      openGraph: { type: "article", publishedTime: "2026-01-01" },
    });
    const og = md.openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-01-01");
    expect(og.siteName).toBe("Cloudless");
  });
});

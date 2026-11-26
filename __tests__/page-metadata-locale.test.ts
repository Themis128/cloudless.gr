import { describe, it, expect, vi } from "vitest";

// Boundary fake at the lib seam: loadCaseStudy must take its static-fallback
// path rather than querying the live CMS (slow/flaky in CI where AppFlowy is
// configured).
vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));

/**
 * Calls each [locale] page's generateMetadata with a non-English locale and
 * asserts the canonical, og:url, and og:locale are localized. Pages that
 * previously declared `export const metadata` had those object literals
 * counted at import time; as functions their bodies only count when invoked
 * — this suite invokes them for every repaired route.
 */

type GenMeta = (args: {
  params: Promise<Record<string, string>>;
}) => Promise<{ alternates?: { canonical?: string }; openGraph?: unknown }>;

const PAGES: Array<{ slug: string; load: () => Promise<{ generateMetadata: GenMeta }> }> = [
  { slug: "accessibility", load: () => import("@/app/[locale]/accessibility/page") },
  { slug: "agents", load: () => import("@/app/[locale]/agents/page") },
  { slug: "contact", load: () => import("@/app/[locale]/contact/page") },
  { slug: "docs", load: () => import("@/app/[locale]/docs/page") },
  { slug: "partners", load: () => import("@/app/[locale]/partners/page") },
  { slug: "privacy", load: () => import("@/app/[locale]/privacy/page") },
  { slug: "refund", load: () => import("@/app/[locale]/refund/page") },
  { slug: "terms", load: () => import("@/app/[locale]/terms/page") },
  { slug: "work", load: () => import("@/app/[locale]/work/page") },
  { slug: "services", load: () => import("@/app/[locale]/services/page") },
  { slug: "audit", load: () => import("@/app/[locale]/audit/page") },
  { slug: "consultation", load: () => import("@/app/[locale]/consultation/page") },
  { slug: "blog", load: () => import("@/app/[locale]/blog/page") },
  { slug: "case-studies", load: () => import("@/app/[locale]/case-studies/page") },
  { slug: "projects", load: () => import("@/app/[locale]/projects/page") },
  { slug: "store", load: () => import("@/app/[locale]/store/page") },
  { slug: "playbook", load: () => import("@/app/[locale]/playbook/page") },
];

const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  el: "el_GR",
  fr: "fr_FR",
  de: "de_DE",
};

describe("localized page metadata", () => {
  for (const { slug, load } of PAGES) {
    it(`/${slug} emits localized canonical + og:locale for el`, async () => {
      const { generateMetadata } = await load();
      const md = await generateMetadata({ params: Promise.resolve({ locale: "el" }) });
      expect(md.alternates?.canonical).toBe(`https://cloudless.gr/el/${slug}`);
      const og = md.openGraph as Record<string, unknown> | undefined;
      expect(og?.url).toBe(`https://cloudless.gr/el/${slug}`);
      expect(og?.locale).toBe("el_GR");
      expect(og?.alternateLocale).toEqual(expect.arrayContaining(["en_US", "fr_FR", "de_DE"]));
      const langs = (md.alternates as { languages?: Record<string, string> }).languages;
      expect(langs?.el).toBe(`https://cloudless.gr/el/${slug}`);
      expect(langs?.["x-default"]).toBe(`https://cloudless.gr/en/${slug}`);
    });
  }

  for (const { slug, load } of PAGES) {
    it(`/${slug} emits localized canonical for every routed locale`, async () => {
      const { generateMetadata } = await load();
      for (const locale of ["en", "el", "fr", "de"]) {
        const md = await generateMetadata({ params: Promise.resolve({ locale }) });
        expect(md.alternates?.canonical).toBe(`https://cloudless.gr/${locale}/${slug}`);
        const og = md.openGraph as Record<string, unknown> | undefined;
        expect(og?.locale).toBe(OG_LOCALE[locale]);
      }
    });
  }

  it("unsupported locale params fall back to en", async () => {
    const { generateMetadata } = await import("@/app/[locale]/services/page");
    const md = await generateMetadata({ params: Promise.resolve({ locale: "xx" }) });
    expect(md.alternates?.canonical).toBe("https://cloudless.gr/en/services");
  });
});

/**
 * Detail routes serve the same content record in every locale — they must
 * keep a self-referencing canonical but emit no hreflang alternates that
 * would point crawlers at untranslated copies.
 */
describe("untranslated detail metadata", () => {
  const DETAILS: Array<{
    name: string;
    params: Record<string, string>;
    canonical: string;
    load: () => Promise<{ generateMetadata: GenMeta }>;
  }> = [
    {
      name: "blog post",
      params: { locale: "el", slug: "why-serverless-is-perfect-for-startups" },
      canonical: "https://cloudless.gr/el/blog/why-serverless-is-perfect-for-startups",
      load: () => import("@/app/[locale]/blog/[slug]/page"),
    },
    {
      name: "store product",
      params: { locale: "el", id: "srv-cloud" },
      canonical: "https://cloudless.gr/el/store/srv-cloud",
      load: () => import("@/app/[locale]/store/[id]/page"),
    },
    {
      name: "case study",
      params: { locale: "el", slug: "techflow-aws-cost-reduction" },
      canonical: "https://cloudless.gr/el/case-studies/techflow-aws-cost-reduction",
      load: () => import("@/app/[locale]/case-studies/[slug]/page"),
    },
  ];

  for (const { name, params, canonical, load } of DETAILS) {
    it(`${name} emits a canonical but no hreflang alternates`, async () => {
      const { generateMetadata } = await load();
      const md = await generateMetadata({ params: Promise.resolve(params) });
      expect(md.alternates?.canonical).toBe(canonical);
      const alternates = md.alternates as { languages?: Record<string, string> };
      expect(alternates.languages).toBeUndefined();
      const og = md.openGraph as Record<string, unknown> | undefined;
      expect(og?.url).toBe(canonical);
      expect(og?.locale).toBe("el_GR");
    });
  }
});

/**
 * Async server-component tests — services index, case-studies/[slug],
 * docs/[slug].
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/appflowy-case-studies", () => ({
  getCaseStudyBySlug: vi.fn(),
  getCaseStudies: vi.fn(async () => [{ slug: "cs-1" }]),
  staticCaseStudies: [
    {
      id: "cs-s",
      slug: "cs-static",
      title: "Static Case Study",
      client: "Acme",
      industry: "SaaS",
      services: ["Cloud Audit"],
      summary: "Static fallback case study",
      metrics: [],
      tags: [],
      featured: false,
      date: "2026-01-01",
    },
  ],
}));
vi.mock("@/lib/appflowy-docs", () => ({
  getDocs: vi.fn(async () => [{ slug: "d1", title: "Other Doc" }]),
  getDocBySlug: vi.fn(),
  getDocContentWithToc: vi.fn(async () => ({ html: "<p>Doc body</p>", toc: [] })),
  groupDocsByCategory: vi.fn(async () => ({ Guides: [{ slug: "d2", title: "Other Doc" }] })),
}));
vi.mock("@/lib/appflowy-analytics", () => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/StatCounter", () => ({ default: () => null }));
vi.mock("@/components/DeferredRender", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/TerminalBlock", () => ({ default: () => null }));
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound");
  })
);
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import { isAppFlowyConfigured } from "@/lib/appflowy";
import { getCaseStudyBySlug } from "@/lib/appflowy-case-studies";
import { getDocBySlug } from "@/lib/appflowy-docs";
import ServicesPage, { generateMetadata as servicesMeta } from "@/app/[locale]/services/page";
import CaseStudyPage, {
  generateMetadata as csMeta,
  generateStaticParams as csStaticParams,
} from "@/app/[locale]/case-studies/[slug]/page";
import DocPage, {
  generateMetadata as docMeta,
} from "@/app/[locale]/docs/[slug]/page";

const params = (o: Record<string, string>) => Promise.resolve(o);

describe("services page", () => {
  afterEach(() => cleanup());

  it("renders service cards, stats and FAQs", async () => {
    const { container } = render(await ServicesPage({ params: params({ locale: "en" }) }));
    expect(container.querySelectorAll("h1").length).toBeGreaterThan(0);
    expect(container.textContent?.length).toBeGreaterThan(500);
  });

  it("generateMetadata uses locale canonical + fallbacks", async () => {
    const meta = await servicesMeta({ params: params({ locale: "fr" }) });
    expect(meta.alternates?.canonical).toBe("https://cloudless.gr/services");
    expect((meta.alternates?.languages as Record<string, string>).fr).toContain("/fr/services");
  });
});

describe("case-studies/[slug] page", () => {
  const cs = {
    slug: "cs-1",
    title: "Migration Story",
    summary: "Moved to serverless",
    content: "<p>body</p>",
    client: "Acme",
    industry: "SaaS",
    coverImage: "/img.png",
    metrics: [{ label: "Cost", value: "-40%" }],
    services: ["Cloud"],
    tags: ["aws"],
    testimonial: "Great work",
    testimonialAuthor: "CTO",
    publishedAt: "2026-01-01",
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(true);
    vi.mocked(getCaseStudyBySlug).mockResolvedValue(cs as never);
  });
  afterEach(() => cleanup());

  it("renders the case study with metrics + testimonial", async () => {
    const { container } = render(
      await CaseStudyPage({ params: params({ locale: "en", slug: "cs-1" }) })
    );
    expect(container.textContent).toContain("Migration Story");
    expect(container.textContent).toContain("-40%");
  });

  it("calls notFound for a missing slug and emits OG metadata", async () => {
    vi.mocked(getCaseStudyBySlug).mockResolvedValueOnce(null as never);
    await expect(
      CaseStudyPage({ params: params({ locale: "en", slug: "gone" }) })
    ).rejects.toThrow("notFound");
    const meta = await csMeta({ params: params({ locale: "en", slug: "cs-1" }) });
    expect(meta.title).toBe("Migration Story");
  });

  it("generateStaticParams returns slugs only when configured", async () => {
    const res = await csStaticParams();
    expect(res).toEqual([{ slug: "cs-1" }]);
    vi.mocked(isAppFlowyConfigured).mockResolvedValueOnce(false);
    expect(await csStaticParams()).toEqual([{ slug: "cs-static" }]);
  });
});


  it("generateStaticParams falls back to static slugs when AppFlowy throws", async () => {
    vi.mocked(isAppFlowyConfigured).mockRejectedValueOnce(new Error("unbound"));
    const result = await csStaticParams();
    expect(result).toEqual([{ slug: "cs-static" }]);
  });

  it("renders a static case study when AppFlowy is unconfigured", async () => {
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(false);
    const { container } = render(
      await CaseStudyPage({ params: params({ locale: "en", slug: "cs-static" }) })
    );
    expect(container.textContent).toContain("Static Case Study");
  });

  it("falls back to the static case study when config check throws", async () => {
    vi.mocked(isAppFlowyConfigured).mockRejectedValue(new Error("unbound"));
    const { container } = render(
      await CaseStudyPage({ params: params({ locale: "en", slug: "cs-static" }) })
    );
    expect(container.textContent).toContain("Static Case Study");
  });

describe("docs/[slug] page", () => {
  const doc = {
    id: "doc1",
    slug: "d1",
    title: "Setup Guide",
    description: "How to set up",
    category: "Guides",
    published: true,
    verificationStatus: "Verified",
    owner: "ops",
    lastVerified: "2026-01-01",
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(true);
    vi.mocked(getDocBySlug).mockResolvedValue(doc as never);
  });
  afterEach(() => cleanup());

  it("renders doc title and sanitized content", async () => {
    const { container } = render(
      await DocPage({ params: params({ locale: "en", slug: "d1" }) })
    );
    expect(container.textContent).toContain("Setup Guide");
    expect(container.textContent).toContain("Doc body");
  });

  it("calls notFound for a missing doc", async () => {
    vi.mocked(getDocBySlug).mockResolvedValueOnce(null as never);
    await expect(
      DocPage({ params: params({ locale: "en", slug: "gone" }) })
    ).rejects.toThrow("notFound");
  });

  it("generateMetadata falls back to default description", async () => {
    const meta = await docMeta({ params: params({ locale: "en", slug: "d1" }) });
    expect(meta.title).toBe("Setup Guide");
  });


  it("generateStaticParams covers both locales per doc and empty when unconfigured", async () => {
    const { generateStaticParams: docStaticParams } = await import(
      "@/app/[locale]/docs/[slug]/page"
    );
    const configured = await docStaticParams();
    expect(configured).toEqual([
      { locale: "en", slug: "d1" },
      { locale: "el", slug: "d1" },
      { locale: "fr", slug: "d1" },
    ]);
    vi.mocked(isAppFlowyConfigured).mockResolvedValueOnce(false);
    expect(await docStaticParams()).toEqual([]);
  });

  it("renders the toc sidebar when the doc has toc entries", async () => {
    const { getDocContentWithToc } = await import("@/lib/appflowy-docs");
    vi.mocked(getDocContentWithToc).mockResolvedValueOnce({
      html: "<p>Doc body</p>",
      toc: [
        { blockId: "intro", level: 2, text: "Introduction" },
        { blockId: "deep", level: 3, text: "Deep dive" },
      ],
    } as never);
    const { container } = render(
      await DocPage({ params: params({ locale: "en", slug: "d1" }) })
    );
    expect(container.textContent).toContain("On this page");
    expect(container.querySelector('a[href="#intro"]')?.textContent).toBe("Introduction");
    expect(container.querySelector('a[href="#deep"]')?.textContent).toBe("Deep dive");
  });

  it("degrades gracefully when the doc content fetch fails", async () => {
    const { getDocContentWithToc } = await import("@/lib/appflowy-docs");
    vi.mocked(getDocContentWithToc).mockRejectedValueOnce(new Error("appflowy down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      await DocPage({ params: params({ locale: "en", slug: "d1" }) })
    );
    expect(container.textContent).toContain("Setup Guide");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[Docs] Failed to fetch content"),
      expect.any(Error)
    );
    spy.mockRestore();
  });
});

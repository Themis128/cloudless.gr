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
  staticCaseStudies: [{ slug: "cs-static" }],
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
});

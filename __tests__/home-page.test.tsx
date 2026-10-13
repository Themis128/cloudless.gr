/**
 * Homepage server-component test — covers the latestPosts blog section
 * plus the main render path.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="cloud-cockpit" />,
}));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/blog-source", () => ({ getBlogPostsWithSource: vi.fn() }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/TypingText", () => ({ default: () => null }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/StatCounter", () => ({ default: () => null }));
vi.mock("@/components/SocialLinks", () => ({ default: () => null }));
vi.mock("@/components/SocialMediaSection", () => ({ default: () => null }));
vi.mock("@/components/HomeNewsletterForm", () => ({ default: () => null }));
vi.mock("@/components/ContactFormSection", () => ({ default: () => null }));
vi.mock("@/components/TrackedBlogCard", () => ({
  default: ({ post }: { post: { title: string } }) => <article>{post.title}</article>,
}));
vi.mock("@/components/TrackedLink", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getBlogPostsWithSource } from "@/lib/blog-source";
import HomePage, { generateMetadata } from "@/app/[locale]/page";

const params = Promise.resolve({ locale: "en" });

describe("homepage", () => {
  afterEach(() => cleanup());

  it("renders the latest-posts section when posts exist", async () => {
    vi.mocked(getBlogPostsWithSource).mockResolvedValue({
      posts: [
        { slug: "p1", title: "First Post", excerpt: "x", date: "2026-01-01", category: "Cloud" },
        { slug: "p2", title: "Second Post", excerpt: "x", date: "2026-01-02", category: "Cloud" },
        { slug: "p3", title: "Third Post", excerpt: "x", date: "2026-01-03", category: "Cloud" },
        { slug: "p4", title: "Fourth Post (cut)", excerpt: "x", date: "2026-01-04", category: "Cloud" },
      ],
      source: "static",
    } as never);
    const { container } = render(await HomePage({ params }));
    expect(container.textContent).toContain("First Post");
    expect(container.textContent).toContain("Third Post");
    expect(container.textContent).not.toContain("Fourth Post (cut)"); // slice(0,3)
  });

  it("omits the blog section when there are no posts", async () => {
    vi.mocked(getBlogPostsWithSource).mockResolvedValue({ posts: [], source: "static" } as never);
    const { container } = render(await HomePage({ params }));
    expect(container.textContent).not.toContain("First Post");
  });

  it("generateMetadata returns locale-aware canonical", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "el" }) });
    expect(meta.alternates?.canonical).toBe("https://cloudless.gr/el");
  });
});

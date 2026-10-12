/**
 * Async server-component tests for public pages — blog listing, blog post,
 * docs. Pages are awaited (async RSC) then rendered with RTL.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/blog-source", () => ({
  getBlogPostsWithSource: vi.fn(),
  getBlogPostBySlug: vi.fn(),
  getBlogPosts: vi.fn(async () => []),
}));
vi.mock("@/lib/appflowy-analytics", () => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/appflowy-docs", () => ({ getDocs: vi.fn() }));
vi.mock("@/components/JsonLd", () => ({ default: () => null }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound");
  })
);
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import { getBlogPostsWithSource, getBlogPostBySlug } from "@/lib/blog-source";
import { getDocs } from "@/lib/appflowy-docs";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import BlogPage, { generateMetadata as blogListMetadata } from "@/app/[locale]/blog/page";
import BlogPostPage, {
  generateMetadata as blogPostMetadata,
} from "@/app/[locale]/blog/[slug]/page";
import DocsPage from "@/app/[locale]/docs/page";

const sp = (params: Record<string, string> = {}) =>
  Promise.resolve(params) as Promise<Record<string, string>>;

afterEach(() => cleanup());

const linkByText = (name: string | RegExp) =>
  screen.getAllByRole("link").find((a) =>
    typeof name === "string" ? a.textContent === name : name.test(a.textContent ?? "")
  );

const post = (n: number, over: Record<string, unknown> = {}) => ({
  slug: `post-${n}`,
  title: `Post Title ${n}`,
  excerpt: `Excerpt for post ${n}`,
  date: "2026-01-05",
  readTime: "4 min read",
  category: n % 2 === 0 ? "Serverless" : "Cloud",
  content: "Intro text",
  published: true,
  ...over,
});

describe("blog listing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBlogPostsWithSource).mockResolvedValue({
      posts: Array.from({ length: 12 }, (_, i) => post(i + 1)),
      source: "static",
    } as never);
  });

  it("renders first page with 10 posts and pagination", async () => {
    const { container } = render(await BlogPage({ searchParams: sp() }));
    expect(container.textContent).toContain("Post Title 1");
    expect(container.textContent).toContain("Post Title 10");
    expect(container.textContent).not.toContain("Post Title 11");
    expect(linkByText("Next →")?.getAttribute("href")).toBe("/blog?page=2");
    expect(container.querySelector('a[href="/blog?category=Cloud"]')).toBeTruthy();
  });

  it("applies search + category filters and shows filter chips", async () => {
    const { container } = render(
      await BlogPage({ searchParams: sp({ q: "title 3", category: "Cloud" }) })
    );
    expect(container.textContent).toContain("Post Title 3");
    expect(container.textContent).not.toContain("Post Title 4");
    expect(linkByText(/"title 3" ✕/)?.getAttribute("href")).toBe("/blog?category=Cloud");
    expect(linkByText(/Cloud ✕/)?.getAttribute("href")).toBe("/blog?q=title+3");
    expect(container.textContent).toContain("1 result");
  });

  it("renders page 2 slice and prev link", async () => {
    const { container } = render(await BlogPage({ searchParams: sp({ page: "2" }) }));
    expect(container.textContent).toContain("Post Title 11");
    expect(linkByText("← Prev")?.getAttribute("href")).toBe("/blog");
    expect(linkByText("Next →")).toBeUndefined();
  });

  it("shows empty state when filter matches nothing", async () => {
    const { container } = render(
      await BlogPage({ searchParams: sp({ q: "zzzz-no-match" }) })
    );
    expect(container.textContent).toContain("No posts found.");
    expect(linkByText("View all posts")).toBeTruthy();
  });

  it("generateMetadata returns blog metadata", async () => {
    const meta = await blogListMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(String(meta.title)).toContain("Blog");
  });
});

describe("blog post page", () => {
  const fixture = {
    ...post(1),
    content:
      "Intro with **bold** and `code` and [a link](https://example.com).\n\nSecond para.\n\n## Section One\n\n- bullet a\n- bullet b\n\n## Section Two\n\nplain section body",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBlogPostBySlug).mockResolvedValue(fixture as never);
  });

  it("renders title, inline markdown, section headers, and lists", async () => {
    const { container } = render(
      await BlogPostPage({ params: Promise.resolve({ locale: "en", slug: "post-1" }) })
    );
    expect(container.querySelector("h1")?.textContent).toBe("Post Title 1");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("code")?.textContent).toBe("code");
    const link = linkByText("a link");
    expect(link?.getAttribute("target")).toBe("_blank");
    const h2s = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(h2s).toContain("Section One");
    expect(h2s).toContain("Section Two");
    expect(container.textContent).toContain("bullet a");
    expect(container.textContent).toContain("plain section body");
    expect(linkByText(/Back to Blog/)?.getAttribute("href")).toBe("/blog");
  });

  it("calls notFound for a missing slug", async () => {
    vi.mocked(getBlogPostBySlug).mockResolvedValue(null as never);
    await expect(
      BlogPostPage({ params: Promise.resolve({ locale: "en", slug: "nope" }) })
    ).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("generateMetadata returns article OG data and {} when missing", async () => {
    const meta = await blogPostMetadata({
      params: Promise.resolve({ locale: "en", slug: "post-1" }),
    });
    expect(meta.title).toBe("Post Title 1");
    expect(meta.alternates?.canonical).toBe("https://cloudless.gr/en/blog/post-1");
    vi.mocked(getBlogPostBySlug).mockResolvedValue(null as never);
    expect(
      await blogPostMetadata({ params: Promise.resolve({ locale: "en", slug: "x" }) })
    ).toEqual({});
  });
});

describe("docs page", () => {
  const doc = (n: number, over: Record<string, unknown> = {}) => ({
    id: `d${n}`,
    slug: `doc-${n}`,
    title: `Doc Title ${n}`,
    description: `Desc ${n}`,
    category: n === 1 ? "Guides" : "Reference",
    order: n,
    verificationStatus: n === 1 ? "Verified" : n === 2 ? "Needs re-verification" : "Unverified",
    owner: "ops",
    lastVerified: "2026-01-01",
    published: true,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(true);
    vi.mocked(getDocs).mockResolvedValue(
      [doc(1), doc(2), doc(3), doc(4, { published: false })] as never
    );
  });

  it("renders published docs grouped by category with verification badges", async () => {
    const { container } = render(await DocsPage({ searchParams: sp() }));
    expect(container.textContent).toContain("Doc Title 1");
    expect(container.textContent).toContain("Doc Title 3");
    expect(container.textContent).not.toContain("Doc Title 4"); // unpublished
    expect(container.textContent).toContain("Guides");
    expect(container.textContent).toContain("Reference");
  });

  it("filters by search query and verification status", async () => {
    const { container } = render(
      await DocsPage({ searchParams: sp({ q: "title 2", status: "Needs re-verification" }) })
    );
    expect(container.textContent).toContain("Doc Title 2");
    expect(container.textContent).not.toContain("Doc Title 1");
  });

  it("renders empty list when AppFlowy is unconfigured or fetch fails", async () => {
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(false);
    const { container } = render(await DocsPage({ searchParams: sp() }));
    expect(container.textContent).not.toContain("Doc Title 1");
    vi.mocked(isAppFlowyConfigured).mockResolvedValue(true);
    vi.mocked(getDocs).mockRejectedValue(new Error("boom"));
    const { container: c2 } = render(await DocsPage({ searchParams: sp() }));
    expect(c2.textContent).not.toContain("Doc Title 1");
  });
});

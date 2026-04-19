import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import {
  posts as staticPosts,
  getPostBySlug as getStaticPost,
  formatDate,
} from "@/lib/blog";
import {
  getPostBySlug as getNotionPost,
  getPostWithToc,
  getRelatedPosts,
  getAllSlugs,
} from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";
import JsonLd from "@/components/JsonLd";
import {
  getBlogPostSchema,
  getBreadcrumbSchema,
} from "@/lib/structured-data";
import React from "react";

export const revalidate = 300; // ISR: revalidate every 5 minutes

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

/** Render inline markdown: **bold**, `code`, [links](url) */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <code
          key={key++}
          className="text-neon-cyan bg-neon-cyan/5 border-neon-cyan/10 rounded border px-1.5 py-0.5 font-mono text-xs"
        >
          {match[3]}
        </code>,
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a
          key={key++}
          href={match[5]}
          className="text-neon-cyan hover:underline"
          target={match[5].startsWith("http") ? "_blank" : undefined}
          rel={match[5].startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {match[4]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

/** Render a block of text — handles bullet lists and plain paragraphs */
function renderBlock(block: string, keyPrefix: number) {
  const lines = block.split("\n");
  const isList = lines.every(
    (l) => l.trim().startsWith("- ") || l.trim() === "",
  );

  if (isList) {
    const items = lines.filter((l) => l.trim().startsWith("- "));
    return (
      <ul
        key={keyPrefix}
        className="mb-4 ml-2 list-inside list-disc space-y-1.5 leading-relaxed text-slate-400"
      >
        {items.map((item, i) => (
          <li key={i}>{renderInline(item.replace(/^-\s*/, ""))}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={keyPrefix} className="mb-4 leading-relaxed text-slate-400">
      {renderInline(block.trim())}
    </p>
  );
}

const categoryColors: Record<string, string> = {
  Cloud: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20",
  Serverless: "bg-neon-green/10 text-neon-green border-neon-green/20",
  Analytics: "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20",
  "AI Marketing": "bg-neon-blue/10 text-neon-blue border-neon-blue/20",
  DevOps: "bg-neon-green/10 text-neon-green border-neon-green/20",
  Security: "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20",
  Architecture: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20",
};

export async function generateStaticParams() {
  const useNotion = isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID");
  const notionSlugs = useNotion ? await getAllSlugs() : [];

  // Combine Notion slugs with static slugs (deduplicated)
  const allSlugs = new Set([...notionSlugs, ...staticPosts.map((p) => p.slug)]);

  return Array.from(allSlugs).flatMap((slug) =>
    ["en", "el", "fr"].map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const canonical = `https://cloudless.gr/${locale}/blog/${slug}`;
  const useNotion = isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID");

  // Try Notion first
  if (useNotion) {
    const post = await getNotionPost(slug);
    if (post) {
      return {
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt,
        alternates: { canonical },
        openGraph: {
          title: post.title,
          description: post.excerpt,
          type: "article",
          publishedTime: post.date,
          ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
        },
      };
    }
  }

  // Fall back to static
  const post = getStaticPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const useNotion = isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID");

  // Try Notion first — use getPostWithToc for TOC support
  if (useNotion) {
    const notionPost = await getPostWithToc(slug);
    if (notionPost) {
      // Fetch related posts
      const related = await getRelatedPosts(notionPost, 3);

      return (
        <>
          <JsonLd
            data={getBlogPostSchema({
              title: notionPost.title,
              excerpt: notionPost.excerpt,
              date: notionPost.date,
              slug: notionPost.slug,
              category: notionPost.category || "Blog",
              coverImage: notionPost.coverImage,
              author: notionPost.author,
            })}
          />
          <JsonLd
            data={getBreadcrumbSchema([
              { name: "Home", url: "https://cloudless.gr" },
              { name: "Blog", url: "https://cloudless.gr/blog" },
              { name: notionPost.title, url: `https://cloudless.gr/blog/${notionPost.slug}` },
            ])}
          />
          {/* Header */}
          <section className="bg-void scanlines relative py-16 text-white md:py-20">
            <div className="cyber-grid absolute inset-0 opacity-30" />
            <div className="relative z-10 mx-auto max-w-3xl px-6">
              <Link
                href="/blog"
                className="hover:text-neon-cyan mb-6 inline-flex items-center gap-2 font-mono text-sm text-slate-500 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 7H3M7 3L3 7l4 4" />
                </svg>
                Back to Blog
              </Link>
              {notionPost.coverImage && (
                <div className="mb-6 overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={notionPost.coverImage}
                    alt={notionPost.title}
                    className="h-56 w-full object-cover md:h-72"
                  />
                </div>
              )}
              <div className="mb-4 flex items-center gap-3">
                <span className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 rounded-full border px-3 py-1 font-mono text-[10px] font-medium">
                  {notionPost.category || "Blog"}
                </span>
                {notionPost.readTime && (
                  <span className="font-mono text-xs text-slate-600">
                    {notionPost.readTime}
                  </span>
                )}
              </div>
              <h1 className="font-heading animate-fade-in-up text-3xl leading-tight font-bold md:text-4xl lg:text-5xl">
                {notionPost.title}
              </h1>
              <div className="animate-fade-in-up mt-4 flex items-center gap-4 delay-100">
                <time className="font-mono text-sm text-slate-500">
                  {formatDate(notionPost.date)}
                </time>
                {notionPost.author && (
                  <span className="font-mono text-sm text-slate-500">
                    by {notionPost.author}
                  </span>
                )}
              </div>
              {notionPost.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {notionPost.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="rounded border border-slate-700 bg-slate-800/50 px-2.5 py-0.5 font-mono text-[10px] text-slate-500 transition-colors hover:border-neon-cyan/30 hover:text-neon-cyan"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Article Body with TOC sidebar */}
          <article className="bg-void py-12 md:py-20">
            <div className="mx-auto max-w-5xl px-6">
              <div className="flex gap-10">
                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="mx-auto max-w-3xl">
                    <div
                      className="prose-custom notion-content"
                      dangerouslySetInnerHTML={{ __html: notionPost.html }}
                    />
                  </div>
                </div>

                {/* TOC sidebar */}
                {notionPost.toc.length > 0 && (
                  <aside className="hidden w-52 flex-none xl:block">
                    <div className="sticky top-24">
                      <p className="mb-3 font-mono text-xs font-medium tracking-widest text-slate-500 uppercase">
                        On this page
                      </p>
                      <ul className="space-y-1 border-l border-slate-800">
                        {notionPost.toc.map((entry) => (
                          <li key={entry.blockId}>
                            <a
                              href={`#${entry.blockId}`}
                              className={`block border-l-2 border-transparent py-1 text-sm transition-colors hover:border-neon-cyan/50 hover:text-slate-200 ${
                                entry.level === 2
                                  ? "pl-4 text-slate-400"
                                  : "pl-7 text-slate-500 text-xs"
                              }`}
                            >
                              {entry.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                )}
              </div>

              {/* Related Posts */}
              {related.length > 0 && (
                <div className="mx-auto mt-16 max-w-3xl">
                  <h2 className="font-heading mb-6 text-xl font-bold text-white">
                    Related Posts
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {related.map((rp) => (
                      <Link
                        key={rp.slug}
                        href={`/blog/${rp.slug}`}
                        className="group neon-border bg-void-light/50 rounded-lg p-5 transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <span
                          className={`mb-2 inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] ${
                            categoryColors[rp.category] ??
                            "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          {rp.category}
                        </span>
                        <h3 className="font-heading group-hover:text-neon-cyan text-sm font-semibold text-white transition-colors line-clamp-2">
                          {rp.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                          {rp.excerpt}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom CTA */}
              <div className="mx-auto mt-12 max-w-3xl">
                <div className="neon-border bg-void-light/50 rounded-xl p-8 text-center">
                  <h3 className="font-heading text-xl font-bold text-white">
                    Need help implementing this?
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Book a free 30-minute audit and we&apos;ll show you exactly
                    where to start.
                  </p>
                  <Link
                    href="/contact"
                    className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-4 inline-block rounded-lg border px-8 py-3 font-mono text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
                  >
                    Get a Free Audit
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </>
      );
    }
  }

  // Fall back to static post
  const post = getStaticPost(slug);
  if (!post) notFound();

  // Simple markdown-ish rendering: split by ## headers
  const sections = post.content.split(/^## /m);
  const intro = sections[0]?.trim();
  const rest = sections.slice(1);

  return (
    <>
      <JsonLd
        data={getBlogPostSchema({
          title: post.title,
          excerpt: post.excerpt,
          date: post.date,
          slug: post.slug,
          category: post.category,
        })}
      />
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Blog", url: "https://cloudless.gr/blog" },
          { name: post.title, url: `https://cloudless.gr/blog/${post.slug}` },
        ])}
      />
      {/* Header */}
      <section className="bg-void scanlines relative py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <Link
            href="/blog"
            className="hover:text-neon-cyan mb-6 inline-flex items-center gap-2 font-mono text-sm text-slate-500 transition-colors"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 7H3M7 3L3 7l4 4" />
            </svg>
            Back to Blog
          </Link>
          <div className="mb-4 flex items-center gap-3">
            <span className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 rounded-full border px-3 py-1 font-mono text-[10px] font-medium">
              {post.category}
            </span>
            <span className="font-mono text-xs text-slate-600">
              {post.readTime}
            </span>
          </div>
          <h1 className="font-heading animate-fade-in-up text-3xl leading-tight font-bold md:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          <time className="animate-fade-in-up mt-4 block font-mono text-sm text-slate-500 delay-100">
            {formatDate(post.date)}
          </time>
        </div>
      </section>

      {/* Article Body */}
      <article className="bg-void py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="prose-custom">
            {intro && (
              <div className="mb-8 text-lg leading-relaxed text-slate-300">
                {intro.split("\n\n").map((para, i) => (
                  <p key={i} className={i > 0 ? "mt-4" : ""}>
                    {renderInline(para)}
                  </p>
                ))}
              </div>
            )}

            {rest.map((section, i) => {
              const [heading, ...bodyParts] = section.split("\n\n");
              return (
                <div key={i} className="mb-8">
                  <h2 className="font-heading mb-4 text-xl font-bold text-white md:text-2xl">
                    {heading?.trim()}
                  </h2>
                  {bodyParts.map((block, j) => renderBlock(block, i * 100 + j))}
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="neon-border bg-void-light/50 mt-12 rounded-xl p-8 text-center">
            <h3 className="font-heading text-xl font-bold text-white">
              Need help implementing this?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Book a free 30-minute audit and we&apos;ll show you exactly where
              to start.
            </p>
            <Link
              href="/contact"
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-4 inline-block rounded-lg border px-8 py-3 font-mono text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
            >
              Get a Free Audit
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}

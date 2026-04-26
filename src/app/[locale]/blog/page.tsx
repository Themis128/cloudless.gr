export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { posts as staticPosts, formatDate } from "@/lib/blog";
import { getPosts, getCategoryCounts, getTagCounts } from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on cloud computing, serverless architecture, data analytics, and AI marketing for startups and SMBs.",
  alternates: {
    canonical: "https://cloudless.gr/blog",
  },
};

const categoryColors: Record<string, string> = {
  Cloud: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20",
  Serverless: "bg-neon-green/10 text-neon-green border border-neon-green/20",
  Analytics:
    "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20",
  "AI Marketing": "bg-neon-blue/10 text-neon-blue border border-neon-blue/20",
  DevOps: "bg-neon-green/10 text-neon-green border border-neon-green/20",
  Security:
    "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20",
  Architecture: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20",
};

const PER_PAGE = 10;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedParams = await searchParams;
  const currentPage = Math.max(
    1,
    parseInt(String(resolvedParams.page ?? "1"), 10) || 1,
  );
  const activeCategory =
    typeof resolvedParams.category === "string"
      ? resolvedParams.category
      : null;
  const activeTag =
    typeof resolvedParams.tag === "string" ? resolvedParams.tag : null;
  const searchQuery =
    typeof resolvedParams.q === "string" ? resolvedParams.q : "";

  // Fetch from Notion when configured, otherwise fall back to static posts
  const useNotion = isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID");
  const notionPosts = useNotion ? await getPosts() : [];

  // Fetch category and tag counts for sidebar
  const [categoryCounts, tagCounts] = useNotion
    ? await Promise.all([getCategoryCounts(), getTagCounts()])
    : [{} as Record<string, number>, {} as Record<string, number>];

  // Normalise into a common shape for rendering
  const allPosts =
    notionPosts.length > 0
      ? notionPosts.map((p) => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          date: p.date,
          readTime: p.readTime || "5 min read",
          category: p.category || "Cloud",
          author: p.author,
          coverImage: p.coverImage,
          tags: p.tags,
        }))
      : staticPosts.map((p) => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          date: p.date,
          readTime: p.readTime,
          category: p.category,
          author: "",
          coverImage: "",
          tags: [] as string[],
        }));

  // Apply filters
  let filteredPosts = allPosts;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredPosts = filteredPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (activeCategory) {
    filteredPosts = filteredPosts.filter((p) => p.category === activeCategory);
  }

  if (activeTag) {
    filteredPosts = filteredPosts.filter((p) => p.tags.includes(activeTag));
  }

  // Pagination
  const total = filteredPosts.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const posts = filteredPosts.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // Build URL helper for filter links
  function filterUrl(params: Record<string, string | null>) {
    const search = new URLSearchParams();
    const values = {
      q: searchQuery || null,
      category: activeCategory,
      tag: activeTag,
      ...params,
    };
    for (const [k, v] of Object.entries(values)) {
      if (v && k !== "page") search.set(k, v);
    }
    const qs = search.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  }

  function pageUrl(page: number) {
    const search = new URLSearchParams();
    if (searchQuery) search.set("q", searchQuery);
    if (activeCategory) search.set("category", activeCategory);
    if (activeTag) search.set("tag", activeTag);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Blog", url: "https://cloudless.gr/blog" },
        ])}
      />

      {/* Header */}
      <section className="bg-void scanlines relative overflow-hidden py-20 text-white md:py-28 lg:py-32">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="bg-neon-cyan/5 animate-float-slow absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="animate-shimmer-text mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ BLOG ]
          </p>
          <h1 className="font-heading animate-fade-in-up text-3xl leading-tight font-bold text-white delay-100 md:text-5xl">
            Insights &amp;{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              practical guides
            </span>
          </h1>
          <p className="animate-fade-in-up mt-6 max-w-xl text-lg text-slate-400 delay-200">
            Cloud architecture, serverless, analytics, and AI marketing —
            written for founders and technical teams who want to move fast.
          </p>

          {/* Search bar */}
          <form
            action=""
            method="get"
            className="animate-scale-in mt-8 max-w-md delay-300"
          >
            <div className="relative">
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search posts…"
                className="w-full rounded-lg border border-slate-700 bg-void-light/50 px-4 py-2.5 pl-10 font-mono text-sm text-white placeholder-slate-600 backdrop-blur-sm transition-colors focus:border-neon-cyan/50 focus:outline-none"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3" />
              </svg>
            </div>
          </form>
        </div>
      </section>

      {/* Posts Grid with Sidebar */}
      <section className="bg-void dot-matrix py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex gap-8 lg:gap-12">
            {/* Main content */}
            <div className="min-w-0 flex-1">
              {/* Active filters */}
              {(activeCategory || activeTag || searchQuery) && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    Filtering:
                  </span>
                  {searchQuery && (
                    <Link
                      href={filterUrl({ q: null })}
                      className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-2.5 py-1 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20"
                    >
                      &quot;{searchQuery}&quot; ✕
                    </Link>
                  )}
                  {activeCategory && (
                    <Link
                      href={filterUrl({ category: null })}
                      className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-2.5 py-1 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20"
                    >
                      {activeCategory} ✕
                    </Link>
                  )}
                  {activeTag && (
                    <Link
                      href={filterUrl({ tag: null })}
                      className="inline-flex items-center gap-1 rounded-full border border-neon-magenta/20 bg-neon-magenta/10 px-2.5 py-1 font-mono text-xs text-neon-magenta transition-colors hover:bg-neon-magenta/20"
                    >
                      #{activeTag} ✕
                    </Link>
                  )}
                  <Link
                    href="/blog"
                    className="font-mono text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear all
                  </Link>
                </div>
              )}

              {/* Results count */}
              {filteredPosts.length !== allPosts.length && (
                <p className="mb-4 font-mono text-xs text-slate-500">
                  {total} result{total !== 1 ? "s" : ""}
                </p>
              )}

              {posts.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
                  <p className="font-mono text-slate-500">No posts found.</p>
                  <Link
                    href="/blog"
                    className="text-neon-cyan mt-2 inline-block font-mono text-sm hover:underline"
                  >
                    View all posts
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {posts.map((post, i) => (
                    <ScrollReveal key={post.slug} delay={i * 100}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="group neon-border bg-void-light/50 block rounded-xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
                      >
                        {post.coverImage && (
                          <div className="mb-4 overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.coverImage}
                              alt={post.title}
                              className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                        )}
                        <div className="mb-4 flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 font-mono text-[10px] font-medium ${
                              categoryColors[post.category] ??
                              "border border-slate-700 bg-slate-800 text-slate-400"
                            }`}
                          >
                            {post.category}
                          </span>
                          <span className="font-mono text-xs text-slate-600">
                            {post.readTime}
                          </span>
                        </div>
                        <h2 className="font-heading group-hover:text-neon-cyan text-xl font-bold text-white transition-colors">
                          {post.title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          {post.excerpt}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <time className="font-mono text-xs text-slate-600">
                              {formatDate(post.date)}
                            </time>
                            {post.author && (
                              <span className="font-mono text-xs text-slate-600">
                                by {post.author}
                              </span>
                            )}
                          </div>
                          <span className="text-neon-cyan inline-flex items-center gap-1 font-mono text-sm font-semibold transition-all group-hover:gap-2">
                            Read more
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 7h8M7 3l4 4-4 4" />
                            </svg>
                          </span>
                        </div>
                        {post.tags && post.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {post.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded border border-slate-700 bg-slate-800/50 px-2 py-0.5 font-mono text-[9px] text-slate-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    </ScrollReveal>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-2">
                  {currentPage > 1 && (
                    <Link
                      href={pageUrl(currentPage - 1)}
                      className="rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-400 transition-colors hover:border-neon-cyan/30 hover:text-neon-cyan"
                    >
                      ← Prev
                    </Link>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Link
                        key={page}
                        href={pageUrl(page)}
                        className={`rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${
                          page === currentPage
                            ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                            : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                        }`}
                      >
                        {page}
                      </Link>
                    ),
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={pageUrl(currentPage + 1)}
                      className="rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-400 transition-colors hover:border-neon-cyan/30 hover:text-neon-cyan"
                    >
                      Next →
                    </Link>
                  )}
                </nav>
              )}
            </div>

            {/* Sidebar */}
            {(categories.length > 0 || tags.length > 0) && (
              <aside className="hidden w-60 flex-none lg:block">
                <div className="sticky top-24 space-y-8">
                  {/* Categories */}
                  {categories.length > 0 && (
                    <div>
                      <h3 className="mb-3 font-mono text-xs font-medium tracking-widest text-slate-500 uppercase">
                        Categories
                      </h3>
                      <ul className="space-y-1">
                        {categories.map(([cat, count]) => (
                          <li key={cat}>
                            <Link
                              href={filterUrl({
                                category: activeCategory === cat ? null : cat,
                              })}
                              className={`flex items-center justify-between rounded px-2 py-1.5 font-body text-sm transition-colors ${
                                activeCategory === cat
                                  ? "text-neon-cyan bg-neon-cyan/5"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <span>{cat}</span>
                              <span className="font-mono text-[10px] text-slate-600">
                                {count}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div>
                      <h3 className="mb-3 font-mono text-xs font-medium tracking-widest text-slate-500 uppercase">
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 20).map(([tag, count]) => (
                          <Link
                            key={tag}
                            href={filterUrl({
                              tag: activeTag === tag ? null : tag,
                            })}
                            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                              activeTag === tag
                                ? "border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta"
                                : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                            }`}
                          >
                            {tag}
                            <span className="ml-1 text-slate-600">{count}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

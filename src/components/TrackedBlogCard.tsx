"use client";

import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import { trackClientEvent } from "@/lib/track-client-event";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { formatDate } from "@/lib/blog";

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
};

export default function TrackedBlogCard({ post, delay = 0 }: { post: Post; delay?: number }) {
  const [locale] = useCurrentLocale();
  const readMore = translate(locale, "blogHighlights.readMore", "Read more");

  return (
    <ScrollReveal delay={delay}>
      <Link
        href={`/blog/${post.slug}`}
        onClick={() =>
          trackClientEvent("home_blog_highlights_click", {
            slug: post.slug,
            category: post.category,
            position: "homepage",
          })
        }
        className="group block h-full rounded-xl border p-6 transition-all duration-200 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div
          className="mb-3 flex items-center gap-3 font-mono text-[10px]"
          style={{ color: "var(--ink-muted)" }}
        >
          <span
            className="rounded-full px-2 py-0.5 tracking-wider"
            style={{
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              color: "var(--accent)",
            }}
          >
            {post.category}
          </span>
          <span>{formatDate(post.date)}</span>
          <span>•</span>
          <span>{post.readTime}</span>
        </div>
        <h3
          className="font-heading mb-3 text-lg font-semibold transition-colors group-hover:text-[var(--accent)]"
          style={{ color: "var(--ink-primary)" }}
        >
          {post.title}
        </h3>
        <p
          className="mb-4 line-clamp-3 text-sm leading-relaxed"
          style={{ color: "var(--ink-body)" }}
        >
          {post.excerpt}
        </p>
        <span
          className="inline-flex items-center gap-1 font-mono text-xs font-semibold"
          style={{ color: "var(--accent)" }}
        >
          {readMore}
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="transition-transform group-hover:translate-x-1"
          >
            <path d="M5 2l5 5-5 5" />
          </svg>
        </span>
      </Link>
    </ScrollReveal>
  );
}

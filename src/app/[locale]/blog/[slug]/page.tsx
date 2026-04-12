import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { posts, getPostBySlug, formatDate } from "@/lib/blog";
import React from "react";

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

export async function generateStaticParams() {
  return posts.flatMap((post) =>
    ["en", "el", "fr"].map((locale) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
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
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Simple markdown-ish rendering: split by ## headers
  const sections = post.content.split(/^## /m);
  const intro = sections[0]?.trim();
  const rest = sections.slice(1);

  return (
    <>
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
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-4 inline-block rounded-lg border px-8 py-3 font-mono text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.
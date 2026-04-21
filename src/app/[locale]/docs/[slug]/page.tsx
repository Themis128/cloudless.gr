import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import {
  getDocs,
  getDocBySlug,
  getDocContentWithToc,
  groupDocsByCategory,
} from "@/lib/notion-docs";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { trackEvent } from "@/lib/notion-analytics";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) return { title: "Not Found" };
  return {
    title: doc.title,
    description: doc.description || `${doc.title} — Cloudless documentation`,
  };
}

export const revalidate = 3600; // Revalidate hourly

export default async function DocPage({ params }: Props) {
  const { slug } = await params;

  const [doc, allDocs] = await Promise.all([getDocBySlug(slug), getDocs()]);

  if (!doc) notFound();

  // Track doc view (fire-and-forget — never blocks render)
  trackEvent({
    event: `doc_view:${slug}`,
    type: "doc_view",
    page: `/docs/${slug}`,
    source: "organic",
  }).catch(() => {});

  // Fetch content with TOC (enhanced)
  const content = await getDocContentWithToc(doc.id);
  const grouped = groupDocsByCategory(allDocs);
  const categories = Object.keys(grouped);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Docs", url: "https://cloudless.gr/docs" },
          { name: doc.title, url: `https://cloudless.gr/docs/${slug}` },
        ])}
      />

      <div className="bg-void min-h-screen text-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex gap-10">
            {/* Sidebar — doc navigation */}
            <aside className="hidden w-56 flex-none lg:block">
              <div className="sticky top-24 space-y-6">
                <Link
                  href="/docs"
                  className="text-neon-cyan/70 hover:text-neon-cyan flex items-center gap-1 font-mono text-xs transition-colors"
                >
                  ← All docs
                </Link>

                {categories.map((category) => (
                  <div key={category}>
                    <p className="mb-2 font-mono text-xs font-medium tracking-widest text-slate-500 uppercase">
                      {category}
                    </p>
                    <ul className="space-y-1">
                      {grouped[category].map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/docs/${d.slug}`}
                            className={`block rounded px-2 py-1.5 font-body text-sm transition-colors ${
                              d.slug === slug
                                ? "text-neon-cyan bg-neon-cyan/5"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {d.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </aside>

            {/* Main content */}
            <main className="min-w-0 flex-1">
              {/* Breadcrumb */}
              <div className="mb-6 flex items-center gap-2 font-mono text-xs text-slate-500">
                <Link
                  href="/docs"
                  className="hover:text-slate-300 transition-colors"
                >
                  Docs
                </Link>
                <span>/</span>
                <span className="text-neon-cyan/80">{doc.category}</span>
                <span>/</span>
                <span className="text-slate-300">{doc.title}</span>
              </div>

              {/* Title */}
              <div className="mb-8">
                <span className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 mb-3 inline-block rounded-full border px-3 py-1 font-mono text-xs">
                  {doc.category}
                </span>
                <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
                  {doc.title}
                </h1>
                {doc.description && (
                  <p className="font-body mt-3 text-lg text-slate-400">
                    {doc.description}
                  </p>
                )}
              </div>

              {/* Content area with inline TOC */}
              <div className="flex gap-10">
                {/* Doc body */}
                <div className="min-w-0 flex-1">
                  {content?.html ? (
                    <div
                      className="prose prose-invert prose-sm md:prose-base max-w-none
                        prose-headings:font-heading prose-headings:text-white
                        prose-p:text-slate-300 prose-p:leading-relaxed
                        prose-a:text-neon-cyan prose-a:no-underline hover:prose-a:underline
                        prose-code:text-neon-cyan prose-code:bg-neon-cyan/5 prose-code:border prose-code:border-neon-cyan/10 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-xs
                        prose-pre:bg-void-light/60 prose-pre:border prose-pre:border-slate-700
                        prose-blockquote:border-neon-cyan/40 prose-blockquote:text-slate-400
                        prose-hr:border-slate-800
                        prose-strong:text-white
                        prose-li:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: content.html }}
                    />
                  ) : (
                    <p className="font-mono text-slate-500">
                      No content available.
                    </p>
                  )}
                </div>

                {/* TOC sidebar (right of content) */}
                {content?.toc && content.toc.length > 0 && (
                  <aside className="hidden w-48 flex-none xl:block">
                    <div className="sticky top-24">
                      <p className="mb-3 font-mono text-xs font-medium tracking-widest text-slate-500 uppercase">
                        On this page
                      </p>
                      <ul className="space-y-1 border-l border-slate-800">
                        {content.toc.map((entry) => (
                          <li key={entry.blockId}>
                            <a
                              href={`#${entry.blockId}`}
                              className={`block border-l-2 border-transparent py-1 text-sm transition-colors hover:border-neon-cyan/50 hover:text-slate-200 ${
                                entry.level === 2
                                  ? "pl-4 text-slate-400"
                                  : "pl-7 text-xs text-slate-500"
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

              {/* Footer nav */}
              <div className="mt-12 border-t border-slate-800 pt-6">
                <Link
                  href="/docs"
                  className="text-neon-cyan/70 hover:text-neon-cyan font-mono text-sm transition-colors"
                >
                  ← Back to all docs
                </Link>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

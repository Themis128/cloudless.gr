export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getWikiDocs, groupDocsByCategory } from "@/lib/notion-docs";
import type { WikiDocRecord } from "@/lib/notion-docs";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Internal guides, integration references, and how-to documentation for the Cloudless platform.",
};

export const revalidate = 3600; // Revalidate hourly

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const VERIFICATION_STYLES: Record<string, { badge: string; icon: string }> = {
  Verified: {
    badge: "bg-neon-green/10 text-neon-green border-neon-green/20",
    icon: "✓",
  },
  "Needs re-verification": {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: "⟳",
  },
  Unverified: {
    badge: "bg-slate-700/40 text-slate-500 border-slate-600/20",
    icon: "?",
  },
};

export default async function DocsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedParams = await searchParams;
  const searchQuery =
    typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  const filterVerification =
    typeof resolvedParams.status === "string" ? resolvedParams.status : null;

  // Use wiki-aware docs for verification metadata
  const allDocs = await getWikiDocs();

  // Apply search filter
  let docs: WikiDocRecord[] = allDocs;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }

  // Apply verification filter
  if (filterVerification) {
    docs = docs.filter((d) => d.verificationStatus === filterVerification);
  }

  const grouped = groupDocsByCategory(docs);
  const categories = Object.keys(grouped);

  // Verification stats
  const verifiedCount = allDocs.filter(
    (d) => d.verificationStatus === "Verified",
  ).length;
  const needsReviewCount = allDocs.filter(
    (d) => d.verificationStatus === "Needs re-verification",
  ).length;
  const unverifiedCount = allDocs.filter(
    (d) => d.verificationStatus === "Unverified",
  ).length;

  function filterUrl(params: Record<string, string | null>) {
    const search = new URLSearchParams();
    const values = {
      q: searchQuery || null,
      status: filterVerification,
      ...params,
    };
    for (const [k, v] of Object.entries(values)) {
      if (v) search.set(k, v);
    }
    const qs = search.toString();
    return `/docs${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Docs", url: "https://cloudless.gr/docs" },
        ])}
      />

      {/* Header */}
      <section className="bg-void scanlines relative py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan animate-fade-in-up mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ DOCS ]
          </p>
          <h1 className="font-heading animate-fade-in-up text-3xl leading-tight font-bold delay-100 md:text-5xl">
            Documentation &amp;{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              guides
            </span>
          </h1>
          <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400 delay-200">
            Everything you need to integrate, configure, and extend the
            Cloudless platform.
          </p>

          {/* Search */}
          <form
            action=""
            method="get"
            className="animate-fade-in-up mt-6 max-w-md delay-300"
          >
            <div className="relative">
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search docs…"
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

      {/* Verification status bar + Docs */}
      <section className="bg-void dot-matrix py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          {/* Verification filter chips */}
          {allDocs.length > 0 && (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">Status:</span>
              <Link
                href={filterUrl({ status: null })}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  !filterVerification
                    ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                All ({allDocs.length})
              </Link>
              <Link
                href={filterUrl({
                  status: filterVerification === "Verified" ? null : "Verified",
                })}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  filterVerification === "Verified"
                    ? "border-neon-green/50 bg-neon-green/10 text-neon-green"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                ✓ Verified ({verifiedCount})
              </Link>
              <Link
                href={filterUrl({
                  status:
                    filterVerification === "Needs re-verification"
                      ? null
                      : "Needs re-verification",
                })}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  filterVerification === "Needs re-verification"
                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                ⟳ Needs Review ({needsReviewCount})
              </Link>
              <Link
                href={filterUrl({
                  status:
                    filterVerification === "Unverified" ? null : "Unverified",
                })}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  filterVerification === "Unverified"
                    ? "border-slate-600/50 bg-slate-700/30 text-slate-400"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                ? Unverified ({unverifiedCount})
              </Link>
            </div>
          )}

          {/* Active search indicator */}
          {searchQuery && (
            <div className="mb-6 flex items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {docs.length} result{docs.length !== 1 ? "s" : ""} for
              </span>
              <Link
                href={filterUrl({ q: null })}
                className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-2.5 py-1 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20"
              >
                &quot;{searchQuery}&quot; ✕
              </Link>
            </div>
          )}

          {docs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
              <p className="font-mono text-slate-500">
                {searchQuery || filterVerification
                  ? "No docs match your filters."
                  : "No documentation published yet."}
              </p>
              {(searchQuery || filterVerification) && (
                <Link
                  href="/docs"
                  className="text-neon-cyan mt-2 inline-block font-mono text-sm hover:underline"
                >
                  View all docs
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {categories.map((category) => (
                <div key={category}>
                  <h2 className="font-heading mb-6 text-xl font-semibold text-white">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(grouped[category] as WikiDocRecord[]).map((doc) => {
                      const vStyle =
                        VERIFICATION_STYLES[doc.verificationStatus] ??
                        VERIFICATION_STYLES.Unverified;
                      return (
                        <Link key={doc.id} href={`/docs/${doc.slug}`}>
                          <div className="group neon-border bg-void-light/50 flex h-full flex-col rounded-xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-neon-cyan font-mono text-xs">
                                {String(doc.order).padStart(2, "0")}
                              </span>
                              <span className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 rounded-full border px-2 py-0.5 font-mono text-xs">
                                {doc.category}
                              </span>
                              {/* Verification badge */}
                              <span
                                className={`ml-auto rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${vStyle.badge}`}
                                title={doc.verificationStatus}
                              >
                                {vStyle.icon}
                              </span>
                            </div>
                            <h3 className="font-heading group-hover:text-neon-cyan mb-2 font-semibold text-white transition-colors">
                              {doc.title}
                            </h3>
                            {doc.description && (
                              <p className="font-body text-sm text-slate-400 line-clamp-2">
                                {doc.description}
                              </p>
                            )}
                            {/* Wiki metadata */}
                            <div className="mt-auto flex flex-wrap gap-2 pt-3">
                              {doc.owner && (
                                <span className="font-mono text-[9px] text-slate-600">
                                  Owner: {doc.owner}
                                </span>
                              )}
                              {doc.lastVerified && (
                                <span className="font-mono text-[9px] text-slate-600">
                                  Verified:{" "}
                                  {new Date(
                                    doc.lastVerified,
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

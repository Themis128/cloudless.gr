import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/blog";
import { getBlogPosts } from "@/lib/blog-source";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on cloud computing, serverless architecture, data analytics, and AI marketing for startups and SMBs.",
};

const categoryColors: Record<string, string> = {
  Cloud: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20",
  Serverless: "bg-neon-green/10 text-neon-green border border-neon-green/20",
  Analytics:
    "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20",
  "AI Marketing": "bg-neon-blue/10 text-neon-blue border border-neon-blue/20",
};

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Blog", url: "https://cloudless.gr/blog" },
        ])}
      />

      <section className="bg-void scanlines relative py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan animate-fade-in-up mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ BLOG ]
          </p>
          <h1 className="font-heading animate-fade-in-up text-3xl leading-tight font-bold delay-100 md:text-5xl">
            Insights &amp;{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              practical guides
            </span>
          </h1>
          <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400 delay-200">
            Cloud architecture, serverless, analytics, and AI marketing —
            written for founders and technical teams who want to move fast.
          </p>
        </div>
      </section>

      <section className="bg-void dot-matrix py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {posts.map((post, i) => (
              <ScrollReveal key={post.slug} delay={i * 100}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group neon-border bg-void-light/50 block rounded-xl p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
                >
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
                    <time className="font-mono text-xs text-slate-600">
                      {formatDate(post.date)}
                    </time>
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
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

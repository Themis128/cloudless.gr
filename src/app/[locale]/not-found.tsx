import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { translate, type Locale, isSupportedLocale, defaultLocale } from "@/lib/i18n";

const FALLBACK = {
  title: "Page not found",
  body: "The page you're looking for doesn't exist or has been moved.",
  cta: "Back to Home",
};

/**
 * In Next.js App Router + next-intl, getLocale() inside a not-found.tsx
 * occasionally returns the default locale instead of the URL-segment
 * locale — the not-found render boundary doesn't always inherit the
 * request scope set by the layout's setRequestLocale call. Parsing
 * x-pathname (set by proxy.ts middleware) is a robust fallback that
 * works across dev and prod.
 */
async function resolveLocale(): Promise<Locale> {
  // Try x-pathname first — most reliable across the not-found boundary.
  try {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "";
    const segment = pathname.split("/")[1] ?? "";
    if (isSupportedLocale(segment)) return segment;
  } catch {
    // headers() can throw outside a request scope; fall through.
  }
  const raw = await getLocale();
  return isSupportedLocale(raw) ? raw : defaultLocale;
}

export default async function LocaleNotFound() {
  const locale = await resolveLocale();

  const m = {
    title: translate(locale, "notFound.title", FALLBACK.title),
    body: translate(locale, "notFound.body", FALLBACK.body),
    cta: translate(locale, "notFound.cta", FALLBACK.cta),
  };

  return (
    <section className="bg-void flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <p className="text-neon-magenta glow-magenta animate-neon-pulse font-mono text-7xl font-bold">
          404
        </p>
        <h1 className="font-heading mt-4 text-3xl font-bold text-white">{m.title}</h1>
        <p className="mt-3 font-mono text-sm text-slate-400">{m.body}</p>
        <Link
          href="/"
          className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-8 inline-block min-h-[44px] rounded-lg border px-8 py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
        >
          {m.cta}
        </Link>
      </div>
    </section>
  );
}

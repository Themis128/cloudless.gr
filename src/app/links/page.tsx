import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import ChecklistSignup from "@/components/ChecklistSignup";
import { countNewsletterSubscribers } from "@/lib/espocrm";
import { getFeaturedTestimonials } from "@/lib/appflowy-testimonials";

// The root layout reads headers(), so the whole route tree renders
// dynamically — `export const revalidate` cannot cache this page. Cache the
// external calls instead: hourly revalidate keeps the subscriber count +
// featured quote fresh without blocking every pageview on EspoCRM/AppFlowy.
// Throw on failure-sentinels so unstable_cache never poisons the cache
// with an upstream-error result (unstable_cache skips caching throws).
const getCachedSubscriberCount = unstable_cache(
  async () => {
    const n = await countNewsletterSubscribers();
    if (n === null) throw new Error("EspoCRM subscriber count unavailable");
    return n;
  },
  ["links-subscriber-count"],
  { revalidate: 3600 }
);
const getCachedFeaturedTestimonials = unstable_cache(
  async () => {
    const list = await getFeaturedTestimonials();
    if (list.length === 0) throw new Error("no featured testimonials available");
    return list;
  },
  ["links-featured-testimonial"],
  { revalidate: 3600 }
);

export const metadata: Metadata = {
  title: "Cloudless — Links & Free Resources",
  description:
    "AI-powered marketing hacks, no-code automation workflows, and free downloads for solo founders and small teams.",
  robots: { index: false },
};

interface HubLink {
  href: string;
  label: string;
  sub: string;
  external?: boolean;
  accent?: boolean;
  /** Lead-magnet slug — renders the card with a ChecklistSignup capture. */
  magnet?: string;
  magnetPitch?: string;
  magnetSuccessText?: string;
}

const LINKS: HubLink[] = [
  {
    href: "/automation-checklist.pdf",
    label: "The 12-Automation Checklist",
    sub: "Free PDF — the exact workflows that run this stack",
    magnet: "automation-checklist",
  },
  {
    href: "/eu-ai-act-checklist.pdf",
    label: "EU AI Act Readiness Checklist",
    sub: "Free PDF — 12 practical checks before the next deadline",
    magnet: "eu-ai-act-checklist",
    magnetPitch:
      "We refresh this checklist as new EU AI Act guidance lands. Leave your email — we'll send the next edition.",
    magnetSuccessText:
      "You're on the list — we'll email the next edition when the guidance moves.",
  },
  {
    // Internal route — same-tab nav. /telegram 307s to the channel invite
    // (or back to /links while TELEGRAM_CHANNEL_URL is unset).
    href: "/telegram",
    label: "Telegram — Automation HQ",
    sub: "Private channel — build logs, drops & automation playbooks",
  },
  {
    href: "https://cloud.cloudless.gr/call/zsykkx97",
    label: "Book a free video consult",
    sub: "30 min — hosted on our own self-hosted Nextcloud Talk",
    external: true,
  },
  {
    href: "https://cloud.cloudless.gr",
    label: "Client Workspace",
    sub: "Private file portal — self-hosted Nextcloud, your data stays ours",
    external: true,
  },
  {
    href: "https://www.linkedin.com/company/cloudless-gr",
    label: "LinkedIn",
    sub: "Weekly automation builds & document playbooks",
    external: true,
  },
  {
    href: "https://www.threads.net/@cloudless.gr",
    label: "Threads",
    sub: "Daily quick takes on AI & no-code ops",
    external: true,
  },
  {
    href: "https://www.tiktok.com/@cloudless.gr",
    label: "TikTok",
    sub: "Short screen-share demos — tools that feel illegal",
    external: true,
  },
  {
    href: "https://www.instagram.com/cloudless.gr",
    label: "Instagram",
    sub: "Carousels & reels for small business automation",
    external: true,
  },
  {
    href: "https://www.facebook.com/cloudless.gr",
    label: "Facebook",
    sub: "Updates, guides & community",
    external: true,
  },
  {
    href: "/en",
    label: "cloudless.gr",
    sub: "Cloud architecture & managed hosting for startups",
    accent: true,
  },
];

export default async function LinksPage() {
  const [subscribers, featured] = await Promise.all([
    getCachedSubscriberCount().catch(() => 0),
    getCachedFeaturedTestimonials().catch(() => []),
  ]);
  const testimonial = featured[0] ?? null;
  // "Name, Role at Company" — but tolerate missing fields: never render
  // dangling commas or a bare "at".
  const testimonialAttribution = testimonial
    ? [
        testimonial.name,
        testimonial.company
          ? testimonial.role
            ? `${testimonial.role} at ${testimonial.company}`
            : testimonial.company
          : testimonial.role,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  return (
    <main className="bg-void min-h-screen text-slate-200">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 py-12">
        <Image
          src="/icons/icon-192.png"
          alt="Cloudless logo"
          width={72}
          height={72}
          className="rounded-2xl border border-slate-800"
          priority
          unoptimized
        />
        <h1 className="mt-5 font-sans text-2xl font-semibold tracking-tight text-white">
          cloudless.gr
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-400">
          AI automation hacks &amp; no-code workflows for founders who would rather ship than
          babysit servers.
        </p>

        {/* Social proof — rendered only when live data exists, never placeholder numbers */}
        {(subscribers > 0 || testimonial) && (
          <div className="bg-void-light/30 mt-5 w-full rounded-xl border border-slate-800 px-4 py-3">
            {subscribers > 0 && (
              <p className="text-center text-xs text-slate-400">
                Join <span className="text-neon-cyan font-semibold">{subscribers}+</span> builders
                already reading the build log.
              </p>
            )}
            {testimonial && (
              <figure className={subscribers > 0 ? "mt-3 border-t border-slate-800 pt-3" : ""}>
                <blockquote className="text-center text-xs leading-relaxed text-slate-300 italic">
                  “{testimonial.quote}”
                </blockquote>
                <figcaption className="mt-1.5 text-center text-[11px] text-slate-500">
                  — {testimonialAttribution}
                </figcaption>
              </figure>
            )}
          </div>
        )}

        <nav className="mt-8 flex w-full flex-col gap-3">
          {LINKS.map((l) =>
            l.magnet ? (
              <div
                key={l.label}
                className="bg-void-light/50 rounded-xl border border-slate-800 px-5 py-3"
              >
                <a
                  href={l.href}
                  className="group flex min-h-[40px] w-full flex-col justify-center transition-colors"
                >
                  <span className="flex items-center justify-between text-[15px] font-medium text-white">
                    {l.label}
                    <span className="text-neon-cyan transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                  <span className="mt-0.5 text-xs text-slate-400">{l.sub}</span>
                </a>
                <ChecklistSignup
                  magnet={l.magnet}
                  pitch={l.magnetPitch}
                  successText={l.magnetSuccessText}
                />
              </div>
            ) : (
              <a
                key={l.label}
                href={l.href}
                {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`group flex min-h-[56px] w-full flex-col justify-center rounded-xl border px-5 py-3 transition-colors ${
                  l.accent
                    ? "border-neon-cyan/60 bg-neon-cyan/10 hover:bg-neon-cyan/20"
                    : "bg-void-light/50 hover:border-neon-cyan/50 border-slate-800"
                }`}
              >
                <span className="flex items-center justify-between text-[15px] font-medium text-white">
                  {l.label}
                  <span className="text-neon-cyan transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
                <span className="mt-0.5 text-xs text-slate-400">{l.sub}</span>
              </a>
            )
          )}
        </nav>

        <p className="mt-10 text-center text-[11px] leading-relaxed text-slate-500">
          Clear skies. Zero friction.
          <br />
          Some links on this site are affiliate links — we only list tools we run ourselves.
        </p>
      </div>
    </main>
  );
}

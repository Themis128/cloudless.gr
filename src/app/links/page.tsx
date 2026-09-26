import type { Metadata } from "next";
import Image from "next/image";

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
}

const LINKS: HubLink[] = [
  {
    href: "/automation-checklist.pdf",
    label: "The 12-Automation Checklist",
    sub: "Free PDF — the exact workflows that run this stack",
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

export default function LinksPage() {
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

        <nav className="mt-8 flex w-full flex-col gap-3">
          {LINKS.map((l) => (
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
          ))}
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

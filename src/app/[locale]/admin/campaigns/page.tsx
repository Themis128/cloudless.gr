"use client";

import Link from "next/link";

const platforms = [
  {
    href: "/admin/campaigns/tiktok",
    name: "TikTok",
    description: "Video ads, spark ads, TopView",
    color: "border-pink-500/30 bg-pink-500/5 hover:border-pink-500/50",
    badge: "text-pink-400",
    dot: "bg-pink-400",
    icon: "♪",
  },
  {
    href: "/admin/campaigns/linkedin",
    name: "LinkedIn",
    description: "Sponsored content, lead gen, InMail",
    color: "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50",
    badge: "text-blue-400",
    dot: "bg-blue-400",
    icon: "in",
  },
  {
    href: "/admin/campaigns/x",
    name: "X (Twitter)",
    description: "Promoted posts, follower campaigns",
    color: "border-slate-500/30 bg-slate-500/5 hover:border-slate-500/50",
    badge: "text-slate-300",
    dot: "bg-slate-300",
    icon: "𝕏",
  },
  {
    href: "/admin/campaigns/google",
    name: "Google Ads",
    description: "Search, display, Performance Max",
    color: "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50",
    badge: "text-yellow-400",
    dot: "bg-yellow-400",
    icon: "G",
  },
  {
    href: "/admin/campaigns/meta",
    name: "Meta",
    description: "Facebook + Instagram — pending policy appeal",
    color: "border-slate-800/50 bg-slate-900/20 cursor-not-allowed opacity-50",
    badge: "text-slate-600",
    dot: "bg-slate-700",
    icon: "f",
    disabled: true,
  },
];

export default function CampaignsDashboard() {
  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CAMPAIGNS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Campaign Manager</h1>
        <p className="font-body mt-1 text-slate-400">
          Manage paid campaigns across all advertising platforms.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) =>
          p.disabled ? (
            <div
              key={p.href}
              className={`rounded-xl border p-5 transition-all ${p.color}`}
            >
              <PlatformCardContent platform={p} />
            </div>
          ) : (
            <Link
              key={p.href}
              href={p.href}
              className={`rounded-xl border p-5 transition-all ${p.color}`}
            >
              <PlatformCardContent platform={p} />
            </Link>
          ),
        )}
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/20 p-5">
        <h2 className="font-heading mb-2 font-semibold text-white">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/calendar" className="font-mono text-xs text-slate-400 hover:text-white transition-colors">
            Content Calendar →
          </Link>
          <Link href="/admin/reports" className="font-mono text-xs text-slate-400 hover:text-white transition-colors">
            Reports →
          </Link>
          <Link href="/admin/ai-assistant" className="font-mono text-xs text-slate-400 hover:text-white transition-colors">
            AI Campaign Assistant →
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlatformCardContent({
  platform,
}: {
  platform: (typeof platforms)[number];
}) {
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <span className={`font-mono text-lg font-bold ${platform.badge}`}>
          {platform.icon}
        </span>
        <div>
          <p className={`font-mono text-sm font-semibold ${platform.badge}`}>
            {platform.name}
          </p>
          {platform.disabled && (
            <span className="rounded-full border border-yellow-900/30 bg-yellow-950/20 px-2 py-0.5 font-mono text-[9px] text-yellow-600">
              PENDING
            </span>
          )}
        </div>
      </div>
      <p className="font-mono text-xs text-slate-500">{platform.description}</p>
    </>
  );
}

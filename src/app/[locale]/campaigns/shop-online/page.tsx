import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCampaign } from "@/data/campaigns";

const campaign = getCampaign("shop-online");

export const metadata: Metadata = {
  title: campaign.title,
  description: campaign.description,
  alternates: {
    canonical: "/campaigns/shop-online",
  },
  openGraph: {
    title: `${campaign.title} | Cloudless`,
    description: campaign.description,
    type: "website",
  },
  // No-index gated landing pages are a discipline call, not a default —
  // this page is meant to rank for branded paid-search queries too, so we
  // leave the default (indexable) here.
};

type Props = { params: Promise<{ locale: string }> };

export default async function ShopOnlineCampaignPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <section className="bg-void scanlines relative py-20 md:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            [ CAMPAIGN · SHOP ONLINE ]
          </p>
          <h1 className="font-heading text-3xl font-bold text-white md:text-5xl">
            {campaign.title.split(" ").slice(0, -2).join(" ")}{" "}
            <span className="from-neon-cyan to-neon-green bg-gradient-to-r bg-clip-text text-transparent">
              {campaign.title.split(" ").slice(-2).join(" ")}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            {campaign.description}
          </p>
        </div>
      </section>

      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {campaign.tiers.map((tier) => (
              <div
                key={tier.id}
                className={`bg-void-light/50 relative rounded-xl border p-6 ${
                  tier.recommended
                    ? "border-neon-cyan/60 shadow-[0_0_30px_rgba(0,255,245,0.15)]"
                    : "border-slate-800"
                }`}
              >
                {tier.recommended ? (
                  <span className="bg-neon-cyan text-void absolute top-0 right-6 -translate-y-1/2 rounded-full px-3 py-1 font-mono text-xs font-bold tracking-widest uppercase">
                    Recommended
                  </span>
                ) : null}
                <h2 className="font-heading text-xl font-bold text-white">{tier.name}</h2>
                <p className="text-neon-cyan glow-cyan mt-2 font-mono text-2xl font-bold">
                  {tier.priceLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{tier.blurb}</p>
                <ul className="mt-6 space-y-2 text-sm text-slate-300">
                  {tier.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="text-neon-green mt-[2px]">▹</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.checkoutHref}
                  className={`mt-8 block w-full rounded-lg border px-5 py-3 text-center font-mono text-sm font-semibold transition-all duration-300 ${
                    tier.recommended
                      ? "bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
                      : "hover:border-neon-cyan/30 hover:text-neon-cyan border-slate-700 text-slate-300"
                  }`}
                  data-campaign={campaign.slug}
                  data-tier={tier.id}
                >
                  Choose {tier.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-void border-t border-slate-800 py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-6 font-mono text-sm text-slate-500">
            Not sure which tier fits? Email{" "}
            <a
              href="mailto:tbaltzakis@cloudless.gr"
              className="text-neon-cyan hover:underline"
            >
              tbaltzakis@cloudless.gr
            </a>{" "}
            and we&apos;ll send a 15-minute scoping reply.
          </p>
          <Link
            href="/services"
            className="hover:border-neon-cyan/30 hover:text-neon-cyan rounded-lg border border-slate-700 px-8 py-3 font-mono font-semibold text-slate-400 transition-all duration-300"
          >
            See all services
          </Link>
        </div>
      </section>
    </>
  );
}

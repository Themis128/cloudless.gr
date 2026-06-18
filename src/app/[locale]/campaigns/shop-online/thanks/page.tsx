import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getCampaign } from "@/data/campaigns";
import ThanksConversion from "./ThanksConversion";

export const dynamic = "force-dynamic";

const campaign = getCampaign("shop-online");

export const metadata: Metadata = {
  title: "Thanks — your order is in",
  description: "Your Shop-Online order is confirmed. Here's what happens next.",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tier?: string; order?: string }>;
};

export default async function ThanksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tier, order } = await searchParams;

  const tierDef = campaign.tiers.find((t) => t.id === tier) ?? null;

  return (
    <>
      <ThanksConversion
        conversionId={campaign.linkedinConversionId}
        tier={tier ?? null}
        orderId={order ?? null}
      />
      <section className="bg-void scanlines relative py-20 md:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <div className="text-neon-cyan glow-cyan mb-6 font-mono text-6xl">&#x2713;</div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
            You&apos;re in.{" "}
            <span className="from-neon-cyan to-neon-green bg-gradient-to-r bg-clip-text text-transparent">
              Welcome aboard.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
            {tierDef
              ? `Your ${tierDef.name} order is confirmed. ${tierDef.blurb}`
              : "Your order is confirmed."}
          </p>
          {order ? (
            <p className="mt-4 font-mono text-xs text-slate-500">
              Reference: <span className="text-neon-cyan">{order}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            [ WHAT HAPPENS NEXT ]
          </p>
          <ol className="mt-6 space-y-4 text-slate-300">
            <li className="border-l-2 border-slate-800 pl-4">
              <span className="text-neon-cyan font-mono text-sm">01 ·</span> A receipt is on its
              way to your email. Keep an eye on spam folders.
            </li>
            <li className="border-l-2 border-slate-800 pl-4">
              <span className="text-neon-cyan font-mono text-sm">02 ·</span> Within one business
              day, we&apos;ll send a kickoff questionnaire and a calendar link.
            </li>
            <li className="border-l-2 border-slate-800 pl-4">
              <span className="text-neon-cyan font-mono text-sm">03 ·</span> First storefront
              preview lands in your inbox inside 7 business days.
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}

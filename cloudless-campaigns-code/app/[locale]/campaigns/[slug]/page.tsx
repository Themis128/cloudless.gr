/**
 * /[locale]/campaigns/[slug] — single campaign landing page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignHero } from "@/components/CampaignHero";
import { TierTable } from "@/components/TierTable";
import { campaigns, getCampaign, type Locale } from "@/data/campaigns";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  return campaigns.flatMap((c) => ["el", "en"].map((locale) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = getCampaign(slug);
  if (!c) return { title: "Campaign not found" };
  const loc = (locale === "el" ? "el" : "en") as Locale;
  return {
    title: `${c.headline[loc]} | Cloudless`,
    description: c.subhead[loc],
    openGraph: {
      title: `${c.headline[loc]} ${c.headlineAccent[loc]}`,
      description: c.subhead[loc],
      images: [{ url: c.ogImage, width: 1200, height: 627 }],
    },
    robots: { index: c.status === "live", follow: true },
  };
}

export default async function CampaignPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (rawLocale !== "el" && rawLocale !== "en") notFound();
  const locale = rawLocale as Locale;
  const c = getCampaign(slug);
  if (!c || c.status === "archived") notFound();

  return (
    <main className="cl-cam-page">
      <CampaignHero campaign={c} locale={locale} />

      <TierTable campaign={c} locale={locale} />

      <section className="cl-cam-faq" aria-label="FAQ">
        <div className="cl-cam-faq__inner">
          <h2>{locale === "el" ? "Συχνές ερωτήσεις" : "FAQ"}</h2>
          <dl>
            {c.faq.map((item, i) => (
              <div key={i}>
                <dt>{item.q[locale]}</dt>
                <dd>{item.a[locale]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="cl-cam-foot">
        <p>
          {locale === "el"
            ? "Δεν είστε σίγουρος ποιο πακέτο ταιριάζει;"
            : "Not sure which tier fits?"}{" "}
          <a href={`/${locale}/contact?topic=${c.slug}`}>
            {locale === "el"
              ? "Κλείστε δωρεάν 20-λεπτη κουβέντα →"
              : "Book a free 20-min fit call →"}
          </a>
        </p>
      </footer>

      {/* prettier-ignore */}
      <style>{`
        .cl-cam-page { color: #1a2528; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        .cl-cam-faq { padding: 72px 24px; background: #ffffff; }
        .cl-cam-faq__inner { max-width: 760px; margin: 0 auto; }
        .cl-cam-faq h2 { font-family: "Fraunces", Georgia, serif; font-size: 28px; font-weight: 500; margin: 0 0 28px; }
        .cl-cam-faq dl { margin: 0; }
        .cl-cam-faq dl > div { padding: 18px 0; border-bottom: 1px solid #eee5d3; }
        .cl-cam-faq dt { font-weight: 600; font-size: 16px; color: #1a2528; margin-bottom: 6px; }
        .cl-cam-faq dd { margin: 0; color: #4a5a5f; font-size: 15px; line-height: 1.6; }
        .cl-cam-foot { padding: 56px 24px; background: #f7f3ec; text-align: center; }
        .cl-cam-foot p { margin: 0; font-size: 16px; color: #1a2528; }
        .cl-cam-foot a { color: #0a7785; font-weight: 600; text-decoration: none; }
      `}</style>
    </main>
  );
}

"use client";

import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { useCookieConsent } from "@/context/CookieConsentContext";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-neon-cyan/80 mb-4 font-heading text-xl font-bold text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

/* ── Cookie table row ──────────────────────────────────── */
function CookieRow({
  name,
  purpose,
  duration,
  category,
}: {
  name: string;
  purpose: string;
  duration: string;
  category: string;
}) {
  const categoryColors: Record<string, string> = {
    necessary: "bg-neon-green/10 text-neon-green border-neon-green/20",
    analytics: "bg-neon-blue/10 text-neon-blue border-neon-blue/20",
    marketing: "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20",
  };
  return (
    <tr className="border-b border-slate-800">
      <td className="py-3 pr-4 font-mono text-xs text-white">{name}</td>
      <td className="py-3 pr-4 text-xs text-slate-400">{purpose}</td>
      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{duration}</td>
      <td className="py-3">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] ${categoryColors[category] ?? ""}`}
        >
          {category}
        </span>
      </td>
    </tr>
  );
}

export default function CookiePolicyPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { openSettings } = useCookieConsent();

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Cookie Policy", url: "https://cloudless.gr/cookies" },
        ])}
      />

      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              {t("legal.legalDocument", "LEGAL DOCUMENT")}
            </p>
            <h1 className="mb-4 font-heading text-3xl font-bold text-white lg:text-4xl">
              {t("legal.cookiePolicyTitle", "Cookie Policy")}
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">
              {t("legal.lastUpdated", "Last updated")}: April 2026
            </p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              {t(
                "legal.cookiePolicyIntro",
                "This Cookie Policy explains what cookies are, how Cloudless uses them on cloudless.gr, and how you can manage your preferences. It complements our Privacy Policy and complies with the EU ePrivacy Directive (2002/58/EC) and GDPR.",
              )}
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section
                id="what-are-cookies"
                title={t("legal.whatAreCookiesTitle", "1. What Are Cookies?")}
              >
                <p>
                  {t(
                    "legal.whatAreCookies",
                    'Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences, understand how you use it, and improve your experience. Cookies may be "session" (deleted when you close your browser) or "persistent" (stored for a set period).',
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="cookie-categories"
                title={t("legal.cookieCategoriesTitle", "2. Cookie Categories")}
              >
                <p className="font-semibold text-white">
                  {t("legal.necessaryCookies", "Necessary Cookies")}
                </p>
                <p>
                  {t(
                    "legal.necessaryCookiesDesc",
                    "Required for the website to function. They enable core features like page navigation, secure areas, and consent management. These cannot be disabled.",
                  )}
                </p>
                <p className="font-semibold text-white">
                  {t("legal.analyticsCookies", "Analytics Cookies")}
                </p>
                <p>
                  {t(
                    "legal.analyticsCookiesDesc",
                    "Help us understand how visitors interact with our site by collecting anonymised data about page visits, traffic sources, and user behaviour. Only set with your explicit consent.",
                  )}
                </p>
                <p className="font-semibold text-white">
                  {t("legal.marketingCookies", "Marketing Cookies")}
                </p>
                <p>
                  {t(
                    "legal.marketingCookiesDesc",
                    "Used to track visitors across websites and display relevant advertisements. These cookies help measure the effectiveness of advertising campaigns. Only set with your explicit consent.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="cookies-we-use"
                title={t("legal.cookiesWeUseTitle", "3. Cookies We Use")}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-2 pr-4 font-mono text-xs font-semibold text-slate-300">
                          {t("legal.cookieName", "Cookie")}
                        </th>
                        <th className="py-2 pr-4 font-mono text-xs font-semibold text-slate-300">
                          {t("legal.cookiePurpose", "Purpose")}
                        </th>
                        <th className="py-2 pr-4 font-mono text-xs font-semibold text-slate-300">
                          {t("legal.cookieDuration", "Duration")}
                        </th>
                        <th className="py-2 font-mono text-xs font-semibold text-slate-300">
                          {t("legal.cookieCategory", "Category")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <CookieRow
                        name="cloudless_consent"
                        purpose="Stores your cookie consent preferences"
                        duration="1 year"
                        category="necessary"
                      />
                      <CookieRow
                        name="NEXT_LOCALE"
                        purpose="Remembers your language preference"
                        duration="Session"
                        category="necessary"
                      />
                      <CookieRow
                        name="cloudless_cart"
                        purpose="Stores shopping cart contents"
                        duration="Session"
                        category="necessary"
                      />
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {t(
                    "legal.cookieTableNote",
                    "This table will be updated as we add analytics or marketing integrations. Currently, no third-party analytics or marketing cookies are set.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="manage-cookies"
                title={t(
                  "legal.manageCookiesTitle",
                  "4. Managing Your Preferences",
                )}
              >
                <p>
                  {t(
                    "legal.manageCookies",
                    'You can change your cookie preferences at any time by clicking the button below, or via the "Cookie Settings" link in our website footer.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={openSettings}
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-2 min-h-[44px] rounded-lg border px-6 py-2 font-mono text-sm font-semibold transition-all"
                >
                  {t("legal.openCookieSettings", "Open Cookie Settings")}
                </button>
                <p className="mt-4">
                  {t(
                    "legal.browserSettings",
                    "You can also control cookies through your browser settings. Most browsers allow you to block or delete cookies. Note that blocking all cookies may affect site functionality.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="more-info"
                title={t("legal.moreInfoTitle", "5. More Information")}
              >
                <p>
                  {t(
                    "legal.moreInfo",
                    "For more details about how we handle your data, see our",
                  )}{" "}
                  <Link
                    href="/privacy"
                    className="text-neon-cyan hover:underline"
                  >
                    {t("legal.privacyTitle", "Privacy Policy")}
                  </Link>
                  {". "}
                  {t(
                    "legal.moreInfoContact",
                    "If you have questions about our use of cookies, contact us at tbaltzakis@cloudless.gr.",
                  )}
                </p>
              </Section>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </>
  );
}

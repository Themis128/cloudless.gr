"use client";

import { Link } from "@/i18n/navigation";
import NewsletterForm from "@/components/NewsletterForm";
import Logo from "@/components/Logo";
import SocialLinks from "@/components/SocialLinks";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { useCookieConsent } from "@/context/CookieConsentContext";

export default function Footer() {
  const [locale] = useCurrentLocale();
  const { openSettings } = useCookieConsent();

  return (
    <footer className="bg-void-lighter border-neon-cyan/20 border-t text-slate-400">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="text-white transition-opacity hover:opacity-90"
              aria-label="cloudless.gr — home"
            >
              <Logo variant="wordmark" size="sm" />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {translate(
                locale,
                "footer.tagline",
                "Clear skies. Zero friction.",
              )}
              <br />
              {translate(
                locale,
                "footer.description",
                "Cloud architecture, serverless, data analytics & AI marketing for startups and SMBs.",
              )}
            </p>
          </div>

          {/* Links */}
          <div>
            <p
              className="text-neon-cyan/70 mb-4 font-mono text-[10px] font-medium tracking-[0.3em]"
              aria-hidden="true"
            >
              {translate(locale, "footer.navigate", "NAVIGATE")}
            </p>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/", key: "common.home", fallback: "Home" },
                {
                  href: "/services",
                  key: "common.services",
                  fallback: "Services",
                },
                { href: "/store", key: "common.store", fallback: "Store" },
                { href: "/blog", key: "common.blog", fallback: "Blog" },
                {
                  href: "/contact",
                  key: "common.contact",
                  fallback: "Contact",
                },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-neon-cyan active:text-neon-cyan inline-block py-1 font-mono text-xs text-slate-400 transition-colors"
                  >
                    <span className="text-neon-cyan/40 mr-2">&gt;</span>
                    {translate(locale, link.key, link.fallback)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p
              className="text-neon-cyan/70 mb-4 font-mono text-[10px] font-medium tracking-[0.3em]"
              aria-hidden="true"
            >
              {translate(locale, "footer.getInTouch", "GET IN TOUCH")}
            </p>
            <ul className="space-y-2 font-mono text-sm">
              <li>
                <a
                  href="mailto:tbaltzakis@cloudless.gr"
                  className="hover:text-neon-cyan active:text-neon-cyan text-xs text-slate-400 transition-colors"
                >
                  tbaltzakis@cloudless.gr
                </a>
              </li>
              <li className="text-xs text-slate-400">
                {translate(locale, "footer.location", "Greece, EU")}
              </li>
            </ul>

            <SocialLinks className="mt-4" />
          </div>

          {/* Newsletter */}
          <div>
            <NewsletterForm />
          </div>
        </div>

        {/* Legal links row */}
        <div className="border-neon-cyan/10 mt-8 border-t pt-6">
          <p
            className="text-neon-cyan/70 mb-4 font-mono text-[10px] font-medium tracking-[0.3em]"
            aria-hidden="true"
          >
            {translate(locale, "footer.legal", "LEGAL")}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              {
                href: "/privacy",
                key: "legal.privacyTitle",
                fallback: "Privacy Policy",
              },
              {
                href: "/terms",
                key: "legal.termsTitle",
                fallback: "Terms of Service",
              },
              {
                href: "/cookies",
                key: "legal.cookiePolicyTitle",
                fallback: "Cookie Policy",
              },
              {
                href: "/refund",
                key: "legal.refundTitle",
                fallback: "Refund & Returns",
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neon-cyan active:text-neon-cyan inline-block py-1 font-mono text-xs text-slate-400 transition-colors"
              >
                {translate(locale, link.key, link.fallback)}
              </Link>
            ))}
            <button
              type="button"
              onClick={openSettings}
              className="hover:text-neon-cyan active:text-neon-cyan inline-block py-1 font-mono text-xs text-slate-400 transition-colors"
            >
              {translate(locale, "footer.cookieSettings", "Cookie Settings")}
            </button>
          </div>
        </div>

        <div className="border-neon-cyan/10 mt-6 flex flex-col items-center justify-between gap-4 border-t pt-6 font-mono text-xs sm:flex-row">
          <p className="text-slate-400">
            &copy; {new Date().getFullYear()} Cloudless.{" "}
            {translate(locale, "footer.rightsReserved", "All rights reserved.")}
          </p>
          <p className="text-slate-400">
            {translate(
              locale,
              "footer.builtWith",
              "Built with Next.js & deployed on AWS",
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}

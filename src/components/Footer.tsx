"use client";

import { Link } from "@/i18n/navigation";
import NewsletterForm from "@/components/NewsletterForm";
import Logo from "@/components/Logo";
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

            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://linkedin.com/in/baltzakis-themis"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="bg-void-light/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://github.com/Themis128"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="bg-void-light/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              <a
                href="https://www.credly.com/users/themistoklis-baltzakis"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Credly"
                className="bg-void-light/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.3 4.8a7.2 7.2 0 110 14.4 7.2 7.2 0 010-14.4zm0 2.4a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6zm0 2.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" />
                </svg>
              </a>
              <a
                href="https://www.baltzakisthemis.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Portfolio"
                className="bg-void-light/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </a>
            </div>
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

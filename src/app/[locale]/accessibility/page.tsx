import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "Cloudless.gr accessibility statement — WCAG 2.1 AA compliance and contact for assistance.",
};

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
      <h2 className="font-heading mb-4 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function AccessibilityPage() {
  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Accessibility Statement", url: "https://cloudless.gr/accessibility" },
        ])}
      />
      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              LEGAL DOCUMENT
            </p>
            <h1 className="font-heading mb-4 text-3xl font-bold text-white lg:text-4xl">
              Accessibility Statement
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">Last updated: June 2026</p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              Cloudless is committed to ensuring digital accessibility for people with disabilities.
              We continually improve the user experience for everyone and apply relevant
              accessibility standards.
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section id="conformance" title="Conformance Status">
                <p>
                  Cloudless.gr aims to conform to the{" "}
                  <strong className="text-white">
                    Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
                  </strong>{" "}
                  as required by the EU Web Accessibility Directive (Directive 2016/2102) and the
                  European Accessibility Act (Directive 2019/882).
                </p>
                <p>
                  We are partially conformant — most content meets WCAG 2.1 AA. Known limitations
                  are listed below.
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section id="measures" title="Measures Taken">
                <p>We have implemented the following to support accessibility:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Semantic HTML5 landmarks and heading hierarchy on all pages</li>
                  <li>Keyboard navigability across all interactive elements</li>
                  <li>ARIA labels on icon-only buttons and form controls</li>
                  <li>Minimum 4.5:1 colour contrast ratio for body text (AA)</li>
                  <li>Minimum 44×44px touch targets for all interactive elements</li>
                  <li>Skip-to-content link on every page</li>
                  <li>Focus trap and Escape-key handling in all modal dialogs</li>
                  <li>
                    Reduced-motion support via{" "}
                    <code className="font-mono text-xs">prefers-reduced-motion</code>
                  </li>
                  <li>
                    All images have descriptive <code className="font-mono text-xs">alt</code>{" "}
                    attributes
                  </li>
                  <li>
                    Forms include visible labels and{" "}
                    <code className="font-mono text-xs">autocomplete</code> attributes
                  </li>
                </ul>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section id="limitations" title="Known Limitations">
                <p>The following known issues are being addressed:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Some third-party embedded content (e.g. EspoCRM forms) may not fully meet WCAG
                    2.1 AA — we are working with vendors on remediation
                  </li>
                  <li>
                    3D particle effects are decorative and hidden from assistive technologies; they
                    respect <code className="font-mono text-xs">prefers-reduced-motion</code>
                  </li>
                </ul>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section id="feedback" title="Feedback & Contact">
                <p>
                  If you experience any accessibility barrier on cloudless.gr, please contact us:
                </p>
                <p className="font-mono text-xs">
                  Email:{" "}
                  <a
                    href="mailto:tbaltzakis@cloudless.gr"
                    className="text-neon-cyan hover:underline"
                  >
                    tbaltzakis@cloudless.gr
                  </a>
                </p>
                <p>
                  We aim to respond to accessibility feedback within{" "}
                  <strong className="text-white">5 business days</strong>.
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section id="enforcement" title="Enforcement">
                <p>
                  If you are not satisfied with our response, you may contact the{" "}
                  <a
                    href="https://www.dpa.gr"
                    className="text-neon-cyan hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hellenic Data Protection Authority (HDPA)
                  </a>{" "}
                  or your national supervisory body.
                </p>
                <p>
                  US users may contact us directly or file a complaint under Section 508 of the
                  Rehabilitation Act where applicable.
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <div className="text-sm text-slate-500">
                <Link href="/privacy" className="text-neon-cyan hover:underline">
                  Privacy Policy
                </Link>
                {" · "}
                <Link href="/terms" className="text-neon-cyan hover:underline">
                  Terms of Service
                </Link>
                {" · "}
                <Link href="/cookies" className="text-neon-cyan hover:underline">
                  Cookie Policy
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </>
  );
}

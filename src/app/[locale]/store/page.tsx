import type { Metadata } from "next";
import StoreGrid from "@/components/store/StoreGrid";
import JsonLd from "@/components/JsonLd";
import { getFAQSchema } from "@/lib/structured-data";

export const revalidate = 3600; // products change infrequently; cache for 1h

export const metadata: Metadata = {
  title: "Store",
  description:
    "Cloud migration playbooks, serverless courses, analytics templates, dev merch, and expert service packages from Cloudless.",
};

const storeFAQs = [
  {
    question: "How does delivery work for digital products?",
    answer:
      "Digital products are delivered instantly after payment. You will receive a download link via email within minutes of completing your purchase.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, American Express) through Stripe. All transactions are encrypted and PCI-compliant.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "We offer a 30-day money-back guarantee on all products and services. If you are not satisfied, contact us at tbaltzakis@cloudless.gr and we will process your refund.",
  },
  {
    question: "How do service engagements work?",
    answer:
      "After purchasing a service, our team will reach out within 24 hours to schedule a kickoff call. We will scope the work, agree on deliverables, and provide a timeline. Most engagements complete within 2 to 4 weeks.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Physical products ship free within the EU. International shipping is available at checkout for an additional fee. Delivery typically takes 5 to 10 business days.",
  },
  {
    question: "Can I upgrade from a digital product to a full service?",
    answer:
      "Yes. If you purchase a playbook or course and later want hands-on help, we will credit the digital product price toward the service engagement.",
  },
];

const testimonials = [
  {
    quote:
      "The Cloud Architecture Audit saved us 40% on our monthly AWS bill. The recommendations were actionable and well-documented.",
    name: "Marina K.",
    role: "CTO, Fintech Startup",
    category: "service",
  },
  {
    quote:
      "The Serverless Masterclass took me from zero to deploying production Lambda functions in under two weeks. Best investment I have made.",
    name: "Dimitris P.",
    role: "Full-Stack Developer",
    category: "digital",
  },
  {
    quote:
      "Their analytics dashboards gave us visibility we never had before. Revenue tracking, user funnels, churn predictions, all in one place.",
    name: "Elena T.",
    role: "Head of Growth, SaaS Platform",
    category: "service",
  },
];

export default function StorePage() {
  return (
    <>
      <JsonLd data={getFAQSchema(storeFAQs)} />

      {/* Header */}
      <section className="bg-void scanlines relative py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ STORE ]
          </p>
          <h1 className="font-heading text-3xl leading-tight font-bold md:text-5xl">
            Tools, templates &amp;{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              expert services.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-400">
            Everything you need to build, scale, and market your cloud-powered
            business. From self-serve digital products to done-for-you services.
          </p>
        </div>
      </section>

      {/* Product Grid */}
      <section className="bg-void dot-matrix py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <StoreGrid />
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            [ TESTIMONIALS ]
          </p>
          <h2 className="font-heading mb-12 text-2xl font-bold text-white md:text-3xl">
            What our clients say
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-void-light/50 hover:border-neon-cyan/30 rounded-xl border border-slate-800 p-6 transition-colors"
              >
                <div className="text-neon-cyan/40 mb-3 font-serif text-3xl">
                  &ldquo;
                </div>
                <p className="text-sm leading-relaxed text-slate-300">
                  {t.quote}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t.name}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Store FAQ */}
      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            [ FAQ ]
          </p>
          <h2 className="font-heading mb-10 text-2xl font-bold text-white md:text-3xl">
            Frequently asked questions
          </h2>

          <div className="space-y-4">
            {storeFAQs.map((faq) => (
              <details
                key={faq.question}
                className="group bg-void open:border-neon-cyan/30 rounded-xl border border-slate-800 transition-colors"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 select-none">
                  <span className="pr-4 text-sm font-semibold text-white">
                    {faq.question}
                  </span>
                  <span className="text-neon-cyan/40 shrink-0 text-lg transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-5 text-sm leading-relaxed text-slate-400">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

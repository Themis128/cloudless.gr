import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Thank you for your purchase from Cloudless.",
};

/* Static Tailwind class maps — dynamic template literals like `bg-${x}` are
   invisible to Tailwind's JIT compiler, so we spell out every variant. */
const accentClasses = {
  "neon-cyan": {
    box: "bg-neon-cyan/10 border-neon-cyan/20",
    text: "text-neon-cyan",
  },
  "neon-magenta": {
    box: "bg-neon-magenta/10 border-neon-magenta/20",
    text: "text-neon-magenta",
  },
  "neon-green": {
    box: "bg-neon-green/10 border-neon-green/20",
    text: "text-neon-green",
  },
} as const;

type Accent = keyof typeof accentClasses;

const nextSteps: {
  icon: string;
  title: string;
  description: string;
  accent: Accent;
}[] = [
  {
    icon: "\u2699",
    title: "Service purchases",
    description:
      "Our team will reach out within 24 hours to schedule your kickoff call. Check your inbox for a calendar invite.",
    accent: "neon-cyan",
  },
  {
    icon: "\u21E9",
    title: "Digital products",
    description:
      "Download links have been sent to your email. You can access your files immediately. Updates are included for life.",
    accent: "neon-magenta",
  },
  {
    icon: "\u2709",
    title: "Physical items",
    description:
      "Your order is being prepared. You will receive a shipping confirmation with tracking within 2 business days. Free EU shipping.",
    accent: "neon-green",
  },
];

export default function SuccessPage() {
  return (
    <>
      <section className="bg-void scanlines relative py-20 md:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <div className="text-neon-cyan glow-cyan mb-6 font-mono text-6xl">
            &#x2713;
          </div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
            Order{" "}
            <span className="from-neon-cyan to-neon-green bg-gradient-to-r bg-clip-text text-transparent">
              confirmed
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
            Thanks for your purchase. A confirmation email with your order
            details and any download links is on its way.
          </p>
        </div>
      </section>

      {/* Next steps by product type */}
      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            [ WHAT HAPPENS NEXT ]
          </p>
          <h2 className="font-heading mb-10 text-2xl font-bold text-white">
            Next steps for your order
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {nextSteps.map((step) => (
              <div
                key={step.title}
                className="bg-void-light/50 rounded-xl border border-slate-800 p-6"
              >
                <div
                  className={`h-10 w-10 ${accentClasses[step.accent].box} mb-4 flex items-center justify-center rounded-lg border text-lg`}
                >
                  <span className={accentClasses[step.accent].text}>
                    {step.icon}
                  </span>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support + CTA */}
      <section className="bg-void border-t border-slate-800 py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-6 font-mono text-sm text-slate-500">
            Questions? Reach us at{" "}
            <a
              href="mailto:tbaltzakis@cloudless.gr"
              className="text-neon-cyan hover:underline"
            >
              tbaltzakis@cloudless.gr
            </a>
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/store"
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-8 py-3 text-center font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
            >
              Continue Shopping
            </Link>
            <Link
              href="/"
              className="hover:border-neon-cyan/30 hover:text-neon-cyan rounded-lg border border-slate-700 px-8 py-3 text-center font-mono font-s
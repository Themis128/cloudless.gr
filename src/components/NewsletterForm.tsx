"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

export default function NewsletterForm() {
  const [locale] = useCurrentLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage(
          translate(
            locale,
            "newsletter.success",
            "You're in! Check your email.",
          ),
        );
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(
          data.error ||
            translate(
              locale,
              "newsletter.error",
              "Something went wrong. Try again.",
            ),
        );
      }
    } catch {
      setStatus("error");
      setMessage(
        translate(
          locale,
          "newsletter.error",
          "Something went wrong. Try again.",
        ),
      );
    }
  }

  return (
    <div>
      <p
        className="text-neon-cyan/70 mb-4 font-mono text-[10px] font-medium tracking-[0.3em]"
        aria-hidden="true"
      >
        {translate(locale, "newsletter.title", "NEWSLETTER")}
      </p>
      <p className="mb-3 text-xs text-slate-400">
        {translate(
          locale,
          "newsletter.subtitle",
          "Cloud tips, cost-saving strategies, and growth hacks. No spam.",
        )}
      </p>
      <form
        onSubmit={handleSubmit}
        className="flex gap-2"
        suppressHydrationWarning
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={translate(
            locale,
            "newsletter.placeholder",
            "your@email.com",
          )}
          required
          className="bg-void focus:border-neon-cyan/50 min-w-0 flex-1 rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 shrink-0 rounded-lg border px-4 py-2 font-mono text-xs font-semibold transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,245,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading"
            ? translate(locale, "newsletter.subscribing", "Subscribing...")
            : translate(locale, "newsletter.cta", "Subscribe")}
        </button>
      </form>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        {translate(
          locale,
          "newsletter.consent",
          "By subscribing, you agree to receive our newsletter and accept our",
        )}{" "}
        <Link
          href="/privacy"
          className="text-neon-cyan/60 underline hover:text-neon-cyan"
        >
          {translate(locale, "legal.privacyTitle", "Privacy Policy")}
        </Link>
        {". "}
        {translate(locale, "newsletter.unsubscribe", "Unsubscribe anytime.")}
      </p>
      {status === "success" && (
        <p className="text-neon-green mt-2 font-mono text-xs">{message}</p>
      )}
      {status === "error" && (
        <p className="mt-2 font-mono text-xs text-red-400">{message}</p>
      )}
    </div>
  );
}

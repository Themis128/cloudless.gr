"use client";

import { useState, useCallback, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import TurnstileWidget from "@/components/TurnstileWidget";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { trackClientEvent } from "@/lib/track-client-event";

const FALLBACK_PDF = "/playbooks/cloud-migration-playbook.pdf";

type Status = "idle" | "loading" | "success" | "error";

interface ApiResponse {
  success?: boolean;
  delivery?: "email" | "already_sent" | "download" | "none";
  playbookUrl?: string;
  error?: string;
  code?: string;
}

const inputClass =
  "min-h-11 w-full rounded-lg border px-3 py-2 font-mono text-sm transition-colors focus:outline-none";
const inputStyle = {
  background: "var(--surface-canvas)",
  borderColor: "var(--border-subtle)",
  color: "var(--ink-primary)",
};

export default function PlaybookLeadForm() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const onTurnstile = useCallback((token: string | null) => setTurnstileToken(token), []);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!consent) {
      setStatus("error");
      setMessage(
        t("playbook.form.consentRequired", "Please confirm you agree to receive the playbook.")
      );
      return;
    }
    setStatus("loading");
    setDownloadUrl(null);
    try {
      const res = await fetch("/api/playbook-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          consent,
          locale,
          website,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (res.ok && data.success) {
        setStatus("success");
        if (data.delivery === "already_sent") {
          setMessage(
            t(
              "playbook.form.alreadySent",
              "This address already received the playbook — check your inbox (and spam folder)."
            )
          );
        } else if (data.delivery === "download" || data.delivery === "none") {
          setMessage(t("playbook.form.successDownload", "Thanks! Download your copy below."));
          setDownloadUrl(data.playbookUrl || FALLBACK_PDF);
        } else {
          setMessage(t("playbook.form.success", "Done! The playbook is on its way to your inbox."));
        }
        setEmail("");
        setName("");
        trackClientEvent("playbook_lead_submit", { delivery: data.delivery ?? "email" });
      } else {
        setStatus("error");
        setMessage(
          data.code === "not_configured" || data.code === "upstream_error"
            ? t(
                "playbook.form.unavailable",
                "We couldn't email the playbook right now — you can download it directly instead."
              )
            : data.error || t("playbook.form.error", "Something went wrong. Please try again.")
        );
        if (data.code === "not_configured" || data.code === "upstream_error") {
          setDownloadUrl(FALLBACK_PDF);
        }
      }
    } catch {
      setStatus("error");
      setMessage(t("playbook.form.error", "Something went wrong. Please try again."));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      suppressHydrationWarning
      aria-label={t("playbook.form.ariaLabel", "Get the Cloud Migration Playbook")}
    >
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        {t("playbook.form.name", "Name (optional)")}
        <input
          type="text"
          name="name"
          autoComplete="name"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        {t("playbook.form.email", "Work email")}
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("newsletter.placeholder", "your@email.com")}
          className={inputClass}
          style={inputStyle}
        />
      </label>
      {/* Honeypot — hidden from humans and assistive tech. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      <label
        className="flex items-start gap-2 text-xs leading-relaxed"
        style={{ color: "var(--ink-muted)" }}
      >
        <input
          type="checkbox"
          name="consent"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          {t(
            "playbook.form.consent",
            "I agree to receive the Cloud Migration Playbook by email and accept the"
          )}{" "}
          <Link href="/privacy" className="underline" style={{ color: "var(--secondary)" }}>
            {t("legal.privacyTitle", "Privacy Policy")}
          </Link>
          .
        </span>
      </label>
      <TurnstileWidget onToken={onTurnstile} />
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-6 py-2.5 font-mono text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "color-mix(in srgb, var(--secondary) 8%, transparent)",
          borderColor: "color-mix(in srgb, var(--secondary) 25%, transparent)",
          color: "var(--secondary)",
        }}
      >
        {status === "loading"
          ? t("playbook.form.sending", "Sending…")
          : t("playbook.form.cta", "Email me the playbook")}
      </button>
      {status !== "idle" && status !== "loading" && (
        <p
          role="status"
          className={`font-mono text-xs ${status === "success" ? "text-neon-green" : "text-red-400"}`}
        >
          {message}
        </p>
      )}
      {downloadUrl && (
        <a
          href={downloadUrl}
          className="font-mono text-xs underline"
          style={{ color: "var(--secondary)" }}
          target="_blank"
          rel="noopener"
        >
          {t("playbook.form.downloadDirect", "Download the PDF")}
        </a>
      )}
    </form>
  );
}

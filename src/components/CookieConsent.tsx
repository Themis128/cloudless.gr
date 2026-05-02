"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import {
  useCookieConsent,
  type CookiePreferences,
} from "@/context/CookieConsentContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

const FLEX_BETWEEN = "flex items-center justify-between";
const HELP_TEXT_CLASS = "mt-1 text-xs text-slate-400";
const CATEGORY_TITLE_CLASS = "text-sm font-semibold text-white";

/* ── Cookie banner + settings modal ──────────────────────── */

export default function CookieConsent() {
  const {
    bannerVisible,
    settingsVisible,
    preferences,
    acceptAll,
    rejectAll,
    savePreferences,
    closeSettings,
  } = useCookieConsent();

  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  // Local toggle state for the settings modal
  const [localPrefs, setLocalPrefs] = useState<CookiePreferences>(preferences);

  // Sync local prefs when settings modal opens
  const handleOpenFromBanner = () => {
    setLocalPrefs(preferences);
  };

  const [showSettings, setShowSettings] = useState(false);

  /* ── Focus trap + Escape key for settings modal ────────── */
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isModalOpen = showSettings || settingsVisible;

  const handleCloseModal = useCallback(() => {
    setShowSettings(false);
    closeSettings();
  }, [closeSettings]);

  // Trap focus inside modal and handle Escape key
  useEffect(() => {
    if (!isModalOpen) {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    // Store the element that had focus before modal opened
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseModal();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus first focusable element in modal
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const first = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      }
    });

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, handleCloseModal]);

  if (!bannerVisible && !settingsVisible) return null;

  /* ── Settings panel (inline or modal) ─────────────────── */
  const settingsPanel = (showSettings || settingsVisible) && (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        className="border-slate-800 bg-void-light mx-4 w-full max-w-lg rounded-xl border p-6 shadow-2xl"
      >
        <h3
          id="cookie-settings-title"
          className="mb-4 font-heading text-lg font-bold text-white"
        >
          {t("cookies.settingsTitle", "Cookie Preferences")}
        </h3>
        <p className="mb-6 text-sm text-slate-400">
          {t(
            "cookies.settingsDesc",
            "Choose which cookies you'd like to allow. Necessary cookies are required for the site to function and cannot be disabled.",
          )}
        </p>

        {/* Necessary — always on */}
        <div className="mb-4 rounded-lg border border-slate-700 p-4">
          <div className={FLEX_BETWEEN}>
            <div>
              <p className={CATEGORY_TITLE_CLASS}>
                {t("cookies.necessary", "Necessary")}
              </p>
              <p className={HELP_TEXT_CLASS}>
                {t(
                  "cookies.necessaryDesc",
                  "Essential for the website to function. Includes session cookies, security tokens, and consent preferences.",
                )}
              </p>
            </div>
            <span className="text-neon-cyan shrink-0 font-mono text-xs">
              {t("cookies.alwaysOn", "Always on")}
            </span>
          </div>
        </div>

        {/* Analytics */}
        <div className="mb-4 rounded-lg border border-slate-700 p-4">
          <div className={FLEX_BETWEEN}>
            <div className="mr-4">
              <p className={CATEGORY_TITLE_CLASS}>
                {t("cookies.analytics", "Analytics")}
              </p>
              <p className={HELP_TEXT_CLASS}>
                {t(
                  "cookies.analyticsDesc",
                  "Help us understand how visitors use our site so we can improve the experience. Data is anonymised.",
                )}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.analytics}
              aria-label={t("cookies.analytics", "Analytics") + " cookies"}
              onClick={() =>
                setLocalPrefs((p) => ({ ...p, analytics: !p.analytics }))
              }
              className={`relative h-8 w-12 shrink-0 rounded-full transition-colors ${
                localPrefs.analytics ? "bg-neon-cyan/60" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white transition-transform ${
                  localPrefs.analytics ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Marketing */}
        <div className="mb-6 rounded-lg border border-slate-700 p-4">
          <div className={FLEX_BETWEEN}>
            <div className="mr-4">
              <p className={CATEGORY_TITLE_CLASS}>
                {t("cookies.marketing", "Marketing")}
              </p>
              <p className={HELP_TEXT_CLASS}>
                {t(
                  "cookies.marketingDesc",
                  "Used to deliver relevant ads and track campaign effectiveness across platforms.",
                )}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.marketing}
              aria-label={t("cookies.marketing", "Marketing") + " cookies"}
              onClick={() =>
                setLocalPrefs((p) => ({ ...p, marketing: !p.marketing }))
              }
              className={`relative h-8 w-12 shrink-0 rounded-full transition-colors ${
                localPrefs.marketing ? "bg-neon-cyan/60" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white transition-transform ${
                  localPrefs.marketing ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => savePreferences(localPrefs)}
            className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] rounded-lg border px-6 py-2 font-mono text-sm font-semibold transition-all"
          >
            {t("cookies.savePreferences", "Save preferences")}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="min-h-[44px] rounded-lg border border-slate-700 px-6 py-2 font-mono text-sm text-slate-300 transition-colors hover:border-slate-500"
          >
            {t("cookies.acceptAll", "Accept all")}
          </button>
          <button
            type="button"
            onClick={handleCloseModal}
            className="min-h-[44px] rounded-lg px-4 py-2 font-mono text-sm text-slate-400 transition-colors hover:text-slate-300"
          >
            {t("cookies.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Banner ───────────────────────────────────────────── */
  if (settingsVisible && !bannerVisible) return settingsPanel;

  if (!bannerVisible) return null;

  return (
    <>
      {settingsPanel}

      {!showSettings && !settingsVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-[10000] p-4"
          role="region"
          aria-label={t("cookies.bannerTitle", "We value your privacy")}
        >
          <div className="border-slate-800 bg-void-light/95 mx-auto max-w-4xl rounded-xl border p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex-1">
                <h3 className="mb-2 font-heading text-sm font-bold text-white">
                  {t("cookies.bannerTitle", "We value your privacy")}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t(
                    "cookies.bannerDesc",
                    "We use cookies to improve your experience, analyse traffic, and personalise content. You can accept all cookies, reject optional ones, or customise your preferences.",
                  )}{" "}
                  <Link href="/cookies" className="text-neon-cyan underline">
                    {t("cookies.learnMore", "Learn more about cookies")}
                  </Link>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col sm:gap-2">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="bg-neon-cyan text-void hover:bg-neon-cyan/90 min-h-[44px] rounded-lg px-5 py-2 font-mono text-xs font-bold transition-all"
                >
                  {t("cookies.acceptAll", "Accept all")}
                </button>
                <button
                  type="button"
                  onClick={rejectAll}
                  className="min-h-[44px] rounded-lg border border-slate-700 px-5 py-2 font-mono text-xs text-slate-300 transition-colors hover:border-slate-500"
                >
                  {t("cookies.rejectAll", "Reject optional")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenFromBanner();
                    setShowSettings(true);
                  }}
                  className="min-h-[44px] rounded-lg px-5 py-2 font-mono text-xs text-slate-400 transition-colors hover:text-slate-300"
                >
                  {t("cookies.customise", "Customise")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

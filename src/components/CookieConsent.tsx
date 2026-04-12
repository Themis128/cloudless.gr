"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import {
  useCookieConsent,
  type CookiePreferences,
} from "@/context/CookieConsentContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

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
            "Choose which cookies y
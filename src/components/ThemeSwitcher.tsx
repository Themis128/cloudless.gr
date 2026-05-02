"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "cloudless-theme-pref";
const ADMIN_PATH_RE = /^\/(?:en|el|fr|de)?\/?admin(?:\/|$)/;
const PREF_EVENT = "cloudless:theme-pref";

const OPTIONS: { value: ThemePref; iconKey: string; labelKey: string; fallback: string }[] = [
  { value: "system", iconKey: "system", labelKey: "common.themeSystem", fallback: "System" },
  { value: "light", iconKey: "sun", labelKey: "common.themeLight", fallback: "Light" },
  { value: "dark", iconKey: "moon", labelKey: "common.themeDark", fallback: "Dark" },
];

function readStoredPref(): ThemePref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "system" || v === "light" || v === "dark") return v;
    return null;
  } catch {
    return null;
  }
}

function writeStoredPref(value: ThemePref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    // Same-tab listeners for ThemePreferenceSync + the inline switcher.
    window.dispatchEvent(new CustomEvent(PREF_EVENT, { detail: value }));
  } catch {
    /* localStorage may be disabled — applying via the data-theme attribute is enough */
  }
}

function subscribeStored(callback: () => void): () => void {
  const onPref = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(PREF_EVENT, onPref);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PREF_EVENT, onPref);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerStoredPref = (): ThemePref | null => null;

function useStoredPref(): ThemePref | null {
  return useSyncExternalStore<ThemePref | null>(
    subscribeStored,
    readStoredPref,
    getServerStoredPref,
  );
}

function ThemeIcon({ kind }: { kind: string }) {
  if (kind === "sun") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (kind === "moon") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path strokeLinecap="round" d="M8 20h8M12 18v2" />
    </svg>
  );
}

export default function ThemeSwitcher() {
  const pathname = usePathname() ?? "/";
  const { user, updatePreferences } = useAuth();
  const [locale] = useCurrentLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Single source of truth for the localStorage override; useSyncExternalStore
  // means writes from ThemeSwitcherInline (or another tab) flow back here.
  const storedPref = useStoredPref();
  const pref: ThemePref = storedPref ?? user?.preferences?.theme ?? "system";

  // Click-outside / Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function onMouse(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // Don't render at all on admin routes — admin is locked to dark.
  if (ADMIN_PATH_RE.test(pathname)) return null;

  const handleSelect = (value: ThemePref) => {
    setIsOpen(false);
    writeStoredPref(value);
    if (user) {
      // Best-effort: failures fall back to localStorage which already applied.
      updatePreferences({ theme: value }).catch(() => {});
    }
  };

  const current = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[0];
  const label = translate(locale, "common.theme", "Theme");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${label}: ${translate(locale, current.labelKey, current.fallback)}. Click to change.`}
        aria-haspopup="listbox"
        aria-controls="theme-listbox"
        className="hover:text-neon-cyan active:text-neon-cyan flex min-h-11 items-center gap-2 px-3 py-2 text-slate-400 transition-colors"
      >
        <ThemeIcon kind={current.iconKey} />
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          id="theme-listbox"
          role="listbox"
          aria-label={label}
          className="bg-void border-neon-cyan/20 absolute top-full right-0 z-50 mt-2 w-36 overflow-hidden rounded-lg border shadow-lg"
        >
          {OPTIONS.map((opt) => {
            const optLabel = translate(locale, opt.labelKey, opt.fallback);
            const selected = opt.value === pref;
            return (
              <button
                type="button"
                key={opt.value}
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(opt.value)}
                aria-label={`${label}: ${optLabel}`}
                className={`hover:bg-neon-cyan/10 active:bg-neon-cyan/20 flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  selected
                    ? "bg-neon-cyan/10 text-neon-cyan font-medium"
                    : "text-slate-300"
                }`}
              >
                <ThemeIcon kind={opt.iconKey} />
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Inline horizontal variant for surfaces where a popover would clip
 * (mobile menu inside an overflow-y-auto container). Same persistence
 * behaviour as the popover variant.
 */
export function ThemeSwitcherInline() {
  const pathname = usePathname() ?? "/";
  const { user, updatePreferences } = useAuth();
  const [locale] = useCurrentLocale();
  const storedPref = useStoredPref();
  const pref: ThemePref = storedPref ?? user?.preferences?.theme ?? "system";

  if (ADMIN_PATH_RE.test(pathname)) return null;

  const handleSelect = (value: ThemePref) => {
    writeStoredPref(value);
    if (user) {
      updatePreferences({ theme: value }).catch(() => {});
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((opt) => {
        const optLabel = translate(locale, opt.labelKey, opt.fallback);
        const selected = opt.value === pref;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => handleSelect(opt.value)}
            aria-label={`Theme: ${optLabel}`}
            className={`min-h-11 min-w-16 rounded-lg border px-3 py-2 font-mono text-sm transition-all active:scale-95 ${
              selected
                ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
            }`}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

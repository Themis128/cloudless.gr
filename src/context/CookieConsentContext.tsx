"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/* ── Types ──────────────────────────────────────────────── */

export type CookieCategory = "necessary" | "analytics" | "marketing";

export interface CookiePreferences {
  necessary: boolean; // always true — cannot be toggled
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentState {
  /** Whether user has made any choice (accept/reject/customise) */
  hasConsented: boolean;
  /** Current preference per category */
  preferences: CookiePreferences;
  /** Show/hide the banner */
  bannerVisible: boolean;
  /** Show/hide the settings modal */
  settingsVisible: boolean;
  /** Accept all categories */
  acceptAll: () => void;
  /** Reject all optional categories (analytics + marketing) */
  rejectAll: () => void;
  /** Save custom preferences */
  savePreferences: (prefs: Partial<CookiePreferences>) => void;
  /** Open the settings modal (e.g. from footer link) */
  openSettings: () => void;
  /** Close the settings modal */
  closeSettings: () => void;
}

/* ── Defaults ────────────────────────────────────────────── */

const COOKIE_NAME = "cloudless_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

const defaultPreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

/* ── Helpers ─────────────────────────────────────────────── */

function readConsentCookie(): {
  hasConsented: boolean;
  preferences: CookiePreferences;
} {
  if (typeof document === "undefined") {
    return { hasConsented: false, preferences: defaultPreferences };
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) {
    return { hasConsented: false, preferences: defaultPreferences };
  }
  try {
    const value = JSON.parse(decodeURIComponent(match.split("=")[1]));
    return {
      hasConsented: true,
      preferences: {
        necessary: true, // always forced
        analytics: Boolean(value.analytics),
        marketing: Boolean(value.marketing),
      },
    };
  } catch {
    return { hasConsented: false, preferences: defaultPreferences };
  }
}

function writeConsentCookie(prefs: CookiePreferences): void {
  const value = encodeURIComponent(
    JSON.stringify({
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      timestamp: new Date().toISOString(),
    }),
  );
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

/* ── Context ─────────────────────────────────────────────── */

const CookieConsentContext = createContext<CookieConsentState | null>(null);

export function useCookieConsent(): CookieConsentState {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}

/* ── Provider ────────────────────────────────────────────── */

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [hasConsented, setHasConsented] = useState(true); // start hidden to avoid flash
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Read persisted consent on mount
  useEffect(() => {
    const stored = readConsentCookie();
    setHasConsented(stored.hasConsented);
    setPreferences(stored.preferences);
    if (!stored.hasConsented) {
      setBannerVisible(true);
    }
  }, []);

  const persist = useCallback((prefs: CookiePreferences) => {
    const finalPrefs = { ...prefs, necessary: true };
    writeConsentCookie(finalPrefs);
    setPreferences(finalPrefs);
    setHasConsented(true);
    setBannerVisible(false);
    setSettingsVisible(false);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ necessary: true, analytics: true, marketing: true });
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({ necessary: true, analytics: false, marketing: false });
  }, [persist]);

  const savePreferences = useCallback(
    (prefs: Partial<CookiePreferences>) => {
      persist({ ...preferences, ...prefs, necessary: true });
    },
    [persist, preferences],
  );

  const openSettings = useCallback(() => {
    setSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{
        hasConsented,
        preferences,
        bannerVisible,
        settingsVisible,
        acceptAll,
        rejectAll,
        savePreferences,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

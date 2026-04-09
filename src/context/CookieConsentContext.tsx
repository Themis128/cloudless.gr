"use client";

import {
  useEffect,
  useReducer,
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";

/* ── Cookies ─────────────────────────────────────────────── */

const COOKIE_NAME = "cookieConsent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export interface CookiePreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

function readConsentCookie(): { hasConsented: boolean; preferences: CookiePreferences } {
  // Safe for SSR - returns defaults if document is not available
  if (typeof document === "undefined") {
    return { hasConsented: false, preferences: defaultPreferences };
  }

  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!value) {
    return { hasConsented: false, preferences: defaultPreferences };
  }

  try {
    const decoded = JSON.parse(decodeURIComponent(value));
    return {
      hasConsented: true,
      preferences: {
        necessary: true,
        analytics: decoded.analytics ?? false,
        marketing: decoded.marketing ?? false,
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

/* ── State Management ────────────────────────────────────── */

interface ConsentState {
  hasConsented: boolean;
  preferences: CookiePreferences;
  bannerVisible: boolean;
  settingsVisible: boolean;
  mounted: boolean;
}

type ConsentAction =
  | { type: "HYDRATE"; payload: { hasConsented: boolean; preferences: CookiePreferences } }
  | { type: "SET_BANNER_VISIBLE"; payload: boolean }
  | { type: "SET_SETTINGS_VISIBLE"; payload: boolean }
  | { type: "SET_PREFERENCES"; payload: CookiePreferences }
  | { type: "MOUNT" };

function consentReducer(state: ConsentState, action: ConsentAction): ConsentState {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        hasConsented: action.payload.hasConsented,
        preferences: action.payload.preferences,
        bannerVisible: !action.payload.hasConsented,
        mounted: true,
      };
    case "SET_BANNER_VISIBLE":
      return { ...state, bannerVisible: action.payload };
    case "SET_SETTINGS_VISIBLE":
      return { ...state, settingsVisible: action.payload };
    case "SET_PREFERENCES":
      return { ...state, preferences: action.payload };
    case "MOUNT":
      return { ...state, mounted: true };
    default:
      return state;
  }
}

/* ── Context ─────────────────────────────────────────────── */

export interface CookieConsentState {
  hasConsented: boolean;
  preferences: CookiePreferences;
  bannerVisible: boolean;
  settingsVisible: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: Partial<CookiePreferences>) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

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
  const initialState: ConsentState = {
    hasConsented: false,
    preferences: defaultPreferences,
    bannerVisible: false,
    settingsVisible: false,
    mounted: false,
  };

  const [state, dispatch] = useReducer(consentReducer, initialState);

  // Hydrate from cookies on mount
  useEffect(() => {
    const stored = readConsentCookie();
    dispatch({
      type: "HYDRATE",
      payload: { hasConsented: stored.hasConsented, preferences: stored.preferences },
    });
  }, []);

  const persist = useCallback((prefs: CookiePreferences) => {
    const finalPrefs = { ...prefs, necessary: true };
    writeConsentCookie(finalPrefs);
    dispatch({ type: "SET_PREFERENCES", payload: finalPrefs });
    dispatch({ type: "SET_BANNER_VISIBLE", payload: false });
    dispatch({ type: "SET_SETTINGS_VISIBLE", payload: false });
  }, []);

  const acceptAll = useCallback(() => {
    persist({ necessary: true, analytics: true, marketing: true });
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({ necessary: true, analytics: false, marketing: false });
  }, [persist]);

  const savePreferences = useCallback(
    (prefs: Partial<CookiePreferences>) => {
      persist({ ...state.preferences, ...prefs, necessary: true });
    },
    [persist, state.preferences],
  );

  const openSettings = useCallback(() => {
    dispatch({ type: "SET_SETTINGS_VISIBLE", payload: true });
  }, []);

  const closeSettings = useCallback(() => {
    dispatch({ type: "SET_SETTINGS_VISIBLE", payload: false });
  }, []);

  // Only show banner on client after hydration
  const visibleBannerOnClient = state.mounted ? state.bannerVisible : false;

  return (
    <CookieConsentContext.Provider
      value={{
        hasConsented: state.hasConsented,
        preferences: state.preferences,
        bannerVisible: visibleBannerOnClient,
        settingsVisible: state.settingsVisible,
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

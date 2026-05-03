/**
 * Shared theme-preference plumbing.
 *
 * Single source of truth for the localStorage override that backs the
 * user-facing theme switcher (ThemeSwitcher in the navbar + the dashboard
 * settings form). ThemePreferenceSync subscribes to the same store so
 * picking a theme on any surface flows to <html data-theme=...> without
 * a reload, and across tabs via the standard `storage` event.
 *
 * Selection priority is enforced in ThemePreferenceSync:
 *   admin path (locked dark)
 *     → user.preferences.theme   (authenticated; lives in Cognito + AuthContext)
 *     → readStoredPref()         (anonymous override, this module)
 *     → themeForRoute(pathname)  (route default)
 */

import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "cloudless-theme-pref";
export const THEME_PREF_EVENT = "cloudless:theme-pref";

export function readStoredPref(): ThemePref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "system" || v === "light" || v === "dark") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the override and notify same-tab and cross-tab listeners.
 * If localStorage is disabled (Safari private mode, etc.) the dispatch is
 * skipped — there's no reliable value to broadcast in that case.
 */
export function writeStoredPref(value: ThemePref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    return;
  }
  // Same-tab listeners (the cross-tab `storage` event only fires in OTHER tabs).
  window.dispatchEvent(new CustomEvent(THEME_PREF_EVENT, { detail: value }));
}

function subscribeStored(callback: () => void): () => void {
  const onPref = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) callback();
  };
  window.addEventListener(THEME_PREF_EVENT, onPref);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_PREF_EVENT, onPref);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerStoredPref = (): ThemePref | null => null;

/**
 * Subscribe to the localStorage override via React's external-store hook.
 * Re-renders the calling component on writes from any surface (navbar,
 * dashboard form, another tab).
 */
export function useStoredPref(): ThemePref | null {
  return useSyncExternalStore<ThemePref | null>(
    subscribeStored,
    readStoredPref,
    getServerStoredPref,
  );
}

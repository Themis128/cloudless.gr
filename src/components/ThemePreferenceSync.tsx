"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { themeForRoute } from "@/components/ThemeProvider";

type StoredPref = "system" | "dark" | "light";
const STORAGE_KEY = "cloudless-theme-pref";

function isAdminPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(?:en|el|fr|de)(?=\/|$)/, "") || "/";
  return stripped === "/admin" || stripped.startsWith("/admin/");
}

function readStoredPref(): StoredPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "system" || v === "dark" || v === "light") return v;
    return null;
  } catch {
    return null;
  }
}

// useSyncExternalStore subscribers for the localStorage override. Using the
// dedicated hook (rather than useEffect+setState) means React handles SSR,
// concurrent rendering, and tearing without setState-in-effect.
function subscribeStored(callback: () => void): () => void {
  const onPref = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("cloudless:theme-pref", onPref);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("cloudless:theme-pref", onPref);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerStoredPref = (): StoredPref | null => null;

export default function ThemePreferenceSync() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const userPref = user?.preferences?.theme;

  // Anonymous-visitor preference, set by ThemeSwitcher. Custom event +
  // storage event keep this hook in sync within the same tab and across tabs.
  const storedPref = useSyncExternalStore<StoredPref | null>(
    subscribeStored,
    readStoredPref,
    getServerStoredPref,
  );

  // Authenticated preference takes priority; anonymous localStorage is the
  // fallback; route-default is the last resort.
  const preferredTheme = userPref ?? storedPref ?? null;

  useEffect(() => {
    const root = document.documentElement;

    if (isAdminPath(pathname)) {
      root.setAttribute("data-theme", "dark");
      return;
    }

    if (preferredTheme === "dark" || preferredTheme === "light") {
      root.setAttribute("data-theme", preferredTheme);
      return;
    }

    if (
      preferredTheme === "system" &&
      typeof window.matchMedia === "function"
    ) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const applySystemTheme = () => {
        root.setAttribute("data-theme", media.matches ? "dark" : "light");
      };

      applySystemTheme();
      media.addEventListener("change", applySystemTheme);
      return () => media.removeEventListener("change", applySystemTheme);
    }

    root.setAttribute("data-theme", themeForRoute(pathname));
  }, [pathname, preferredTheme]);

  return null;
}

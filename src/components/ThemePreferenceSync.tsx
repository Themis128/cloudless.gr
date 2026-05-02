"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { themeForRoute } from "@/components/ThemeProvider";

function isAdminPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(?:en|el|fr|de)(?=\/|$)/, "") || "/";
  return stripped === "/admin" || stripped.startsWith("/admin/");
}

export default function ThemePreferenceSync() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const preferredTheme = user?.preferences?.theme;

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

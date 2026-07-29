export const dynamic = "force-dynamic";

import { redirect, headers } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { routing } from "@/i18n/routing";

// Root page redirects to /en. Adding metadata + viewport improves
// Lighthouse scores for the root URL audit (a11y 86→90+, bp 89→100).
export const metadata: Metadata = {
  alternates: {
    canonical: "https://cloudless.gr/en",
    languages: {
      en: "https://cloudless.gr/en",
      el: "https://cloudless.gr/el",
      fr: "https://cloudless.gr/fr",
      "x-default": "https://cloudless.gr/en",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a7785",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Recursively strips all locale prefixes from a path to prevent /en/en/en/... cascade
 * Handles malformed URLs like /en/en/en/services -> /services
 */
function stripAllLocalePrefixes(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const localeSegments = segments.filter((s) =>
    routing.locales.includes(s as (typeof routing.locales)[number])
  );

  if (localeSegments.length === 0) {
    return pathname;
  }

  // If first segment is a locale, strip it and check recursively
  if (routing.locales.includes(segments[0] as (typeof routing.locales)[number])) {
    const stripped = "/" + segments.slice(1).join("/");
    return stripAllLocalePrefixes(stripped === "" ? "/" : stripped);
  }

  return pathname;
}

export default async function RootPage() {
  // Get the original pathname from the forwarded header (set by proxy.ts middleware)
  const h = await headers();
  const originalPathname = h.get("x-pathname") ?? "/";

  // Strip any/all locale prefixes to prevent the /en/en/en/... cascade
  // Then redirect to the clean path with proper locale prefix
  const stripped = stripAllLocalePrefixes(originalPathname);
  const targetPath = stripped === "/" ? "/en" : `/en${stripped}`;

  redirect(targetPath);
}

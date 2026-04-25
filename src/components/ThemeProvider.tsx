/**
 * ThemeProvider — sets data-theme on <html> based on the current route.
 *
 * Phase 2 ships dark for every route to keep text-white-on-dark contrasts
 * working. Phase 3 introduces light mode page-by-page by changing the
 * `themeForRoute()` mapping below — no component code needs to change,
 * tokens flip via theme-v2.css [data-theme="light"] block.
 *
 * This is rendered server-side in src/app/layout.tsx so the initial HTML
 * already has the right data-theme attribute and there is no first-paint
 * flash when JS hydrates.
 */

type Theme = "light" | "dark";

/**
 * Decide which theme a given pathname should render with.
 *
 * Phase 3 in progress: /services is the first marketing route flipped to
 * light. Other marketing routes follow once we've watched /services in
 * production and adjusted any leftover dark-only utilities.
 */
export function themeForRoute(pathname: string): Theme {
  // Strip locale prefix so the same rules apply across en/el/fr.
  const stripped = pathname.replace(/^\/(?:en|el|fr)(?=\/|$)/, "") || "/";

  // Admin always dark. Long sessions, low ambient light, stays dark forever.
  if (stripped === "/admin" || stripped.startsWith("/admin/")) {
    return "dark";
  }

  // Marketing routes flipped to light, one prefix at a time.
  // The homepage stays dark for now — Phase 4 redesigns the hero with the
  // gradient-mesh and at that point the homepage flips together with the
  // hero refresh. /auth and /dashboard stay dark by intent.
  const lightRoutes = [
    "/services",
    "/blog",
    "/contact",
    "/store",
    "/docs",
    "/privacy",
    "/terms",
    "/cookies",
    "/refund",
  ];
  if (lightRoutes.some((p) => stripped === p || stripped.startsWith(p + "/"))) {
    return "light";
  }

  // Everything else (homepage, auth, dashboard) stays on v2 dark.
  return "dark";
}

/**
 * Returns just the data-theme attribute value, suitable to spread onto
 * the root <html> element from a Server Component.
 *
 * Usage in src/app/layout.tsx:
 *   import { themeForRoute } from "@/components/ThemeProvider";
 *   import { headers } from "next/headers";
 *   ...
 *   const pathname = (await headers()).get("x-pathname") ?? "/";
 *   const theme = themeForRoute(pathname);
 *   return <html lang="en" data-theme={theme}>...
 *
 * Or, simpler: hard-code "dark" on <html> in Phase 2 and call this from
 * Phase 3 once the route-aware logic actually has light routes to switch
 * between.
 */
export function dataThemeAttr(pathname: string): { "data-theme": Theme } {
  return { "data-theme": themeForRoute(pathname) };
}

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
 * Phase 2 default: every route renders dark. Flip individual prefixes to
 * "light" as their primitives are migrated in Phase 3.
 */
export function themeForRoute(pathname: string): Theme {
  // Admin always dark. Long sessions, low ambient light, stays dark forever.
  if (pathname.startsWith("/admin") || pathname.includes("/admin/")) {
    return "dark";
  }

  // Phase 2: marketing routes also dark, awaiting Phase 3 light-mode rollout.
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

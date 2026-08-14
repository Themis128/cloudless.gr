import { routing } from "@/i18n/routing";

/** First path segment if it is a supported locale (`/el/services` → `el`). */
export function localeFromPathname(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && (routing.locales as readonly string[]).includes(first)) return first;
  return null;
}

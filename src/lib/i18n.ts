import en from "@/locales/en.json";
import el from "@/locales/el.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";

export const locales = ["en", "el", "fr", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

const dictionaries = {
  en,
  el,
  fr,
  de,
} as const;

type Messages = typeof en;

export const localeLabels: Record<Locale, string> = {
  en: "English",
  el: "Ελληνικά",
  fr: "Français",
  de: "Deutsch",
};

export function isSupportedLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/** Resolve a dot-separated key to its value inside a Messages object. */
function resolve(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, messages);
}

/** Return a translated string for the given key, or the fallback when missing. */
export function translate(
  locale: Locale,
  key: string,
  fallback: string,
): string {
  const candidate = resolve(getMessages(locale), key);
  return typeof candidate === "string" ? candidate : fallback;
}

/** Return a translated string-array for the given key, or the fallback when missing. */
export function translateArray(
  locale: Locale,
  key: string,
  fallback: string[],
): string[] {
  const candidate = resolve(getMessages(locale), key);
  return Array.isArray(candidate) ? (candidate as string[]) : fallback;
}

import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import type { AbstractIntlMessages } from "next-intl";

function isValidLocale(
  value: string | undefined,
): value is (typeof routing.locales)[number] {
  return (
    typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
  );
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isValidLocale(requested) ? requested : routing.defaultLocale;

  // Static imports avoid dynamic-import issues with Turbopack
  // Cast needed because JSON arrays (e.g. typingTexts) are string[] which
  // doesn't satisfy AbstractIntlMessages index signature in next-intl 3.x
  let messages: AbstractIntlMessages;
  if (locale === "el") {
    messages = (await import("../locales/el.json"))
      .default as unknown as AbstractIntlMessages;
  } else if (locale === "fr") {
    messages = (await import("../locales/fr.json"))
      .default as unknown as AbstractIntlMessages;
  } else {
    messages = (await import("../locales/en.json"))
      .default as unknown as AbstractIntlMessages;
  }

  return { locale, messages };
});

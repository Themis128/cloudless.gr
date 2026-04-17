import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

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

  // Static imports avoid dynamic-import issues with Turbopack.
  // AbstractIntlMessages was removed in next-intl v4; cast through unknown
  // since JSON arrays (e.g. typingTexts: string[]) don't satisfy the index
  // signature expected by getRequestConfig.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: any;
  if (locale === "el") {
    messages = (await import("../locales/el.json")).default;
  } else if (locale === "fr") {
    messages = (await import("../locales/fr.json")).default;
  } else {
    messages = (await import("../locales/en.json")).default;
  }

  return { locale, messages };
});

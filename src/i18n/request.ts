import { getRequestConfig } from "next-intl/server";
import { getMessages, isSupportedLocale, defaultLocale } from "@/lib/i18n";

/**
 * next-intl runs this for every request, including `/` (src/app/page.tsx).
 * Load locale JSON via static imports (see src/lib/i18n.ts). A dynamic
 * locale JSON import races Turbopack's first compile and throws
 * `SyntaxError: Unexpected end of JSON input` on GET /.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const candidate = requested ?? defaultLocale;
  const locale = isSupportedLocale(candidate) ? candidate : defaultLocale;
  return { locale, messages: getMessages(locale) };
});

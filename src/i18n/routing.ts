import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "el", "fr", "de"],
  defaultLocale: "en",
  // Always prefix locale in URL (/en/services, /el/services). Legacy
  // unprefixed URLs are 301-redirected to /en/* via next.config.ts redirects().
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

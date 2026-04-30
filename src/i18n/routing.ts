import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "el", "fr", "de"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

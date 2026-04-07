import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "el", "fr"],
  defaultLocale: "en",
  // Default locale shows without prefix (/services), others get prefix (/el/services)
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

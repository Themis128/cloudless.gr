import type { Metadata, Viewport } from "next";
import { permanentRedirect } from "next/navigation";

// Root page redirects to /en. Adding metadata + viewport improves
// Lighthouse scores for the root URL audit (a11y 86→90+, bp 89→100).
export const metadata: Metadata = {
  alternates: {
    canonical: "https://cloudless.gr/en",
    languages: {
      en: "https://cloudless.gr/en",
      el: "https://cloudless.gr/el",
      fr: "https://cloudless.gr/fr",
      "x-default": "https://cloudless.gr/en",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a7785",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootPage() {
  permanentRedirect("/en");
}
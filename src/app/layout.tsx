import type { Metadata } from "next";
import { Instrument_Sans, Work_Sans, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { themeForRoute } from "@/components/ThemeProvider";
import { HubSpotScript } from "@/components/HubSpotScript";
import "./globals.css";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://cloudless.gr"),
  title: {
    default: "Cloudless — Cloud Computing, Serverless & AI Marketing",
    template: "%s | Cloudless",
  },
  description:
    "Training & portfolio project — built for educational purposes only, not a commercial service. Demonstrates cloud architecture, serverless, data analytics, and AI-powered marketing on Next.js & AWS.",
  keywords: [
    "cloud computing",
    "serverless",
    "data analytics",
    "AI marketing",
    "digital marketing",
    "cloud migration",
    "Greece",
  ],
  authors: [{ name: "Cloudless" }],
  verification: {
    google: "LXkyzmWrAYuY1C6XD6TKaqA31KB72xbUlkimE0vKI8w",
  },
  openGraph: {
    title: "Cloudless — Training & Portfolio Project",
    description:
      "Educational & portfolio project only — not a commercial service. Demonstrates cloud architecture, serverless, analytics & AI marketing on Next.js & AWS.",
    url: "https://cloudless.gr",
    siteName: "Cloudless",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cloudless — Training & Portfolio Project",
    description:
      "Educational & portfolio project only — not a commercial service. Cloud architecture, serverless, analytics & AI marketing on Next.js & AWS.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pathname is forwarded via x-pathname by middleware (src/proxy.ts).
  // Falls back to "/" for routes outside the matcher (which we don't render).
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const theme = themeForRoute(pathname);
  const _seg = pathname.split("/")[1];
  const locale = (routing.locales as readonly string[]).includes(_seg) ? _seg : routing.defaultLocale;

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      data-theme={theme}
      className={`${instrumentSans.variable} ${workSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>
        {META_PIXEL_ID ? (
          <>
            <Script id="meta-pixel-init" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
                document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        ) : null}
        <HubSpotScript />
        {GA_ID ? (
          <>
            {/* Consent Mode v2 — default to denied before user responds to banner */}
            <Script id="gtag-consent-init" strategy="beforeInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                wait_for_update: 500
              });
            `}</Script>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}

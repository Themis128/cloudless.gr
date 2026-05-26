import type { Metadata } from "next";
import { Instrument_Sans, Work_Sans, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { themeForRoute } from "@/components/ThemeProvider";
import { HubSpotScript } from "@/components/HubSpotScript";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import "./globals.css";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial"],
  adjustFontFallback: false,
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial"],
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
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
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
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
  // Pathname and nonce are forwarded by middleware (src/proxy.ts).
  // x-pathname falls back to "/" for routes outside the matcher.
  // x-nonce is a per-request random value that matches the CSP nonce in the
  // Content-Security-Policy header — every <Script> must carry it so the
  // browser accepts the inline runtime scripts Next.js emits.
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const nonce = requestHeaders.get("x-nonce") ?? "";
  const theme = themeForRoute(pathname);
  const _seg = pathname.split("/")[1];
  const locale = (routing.locales as readonly string[]).includes(_seg)
    ? _seg
    : routing.defaultLocale;

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
        <ChunkReloadGuard />
        {META_PIXEL_ID ? (
          <>
            <Script id="meta-pixel-init" strategy="afterInteractive" nonce={nonce}>
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
        <HubSpotScript nonce={nonce} />
        {GA_ID ? (
          <>
            {/* Consent Mode v2 — default to denied before user responds to banner */}
            <Script id="gtag-consent-init" strategy="beforeInteractive" nonce={nonce}>{`
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
              nonce={nonce}
            />
            <Script id="gtag-init" strategy="afterInteractive" nonce={nonce}>{`
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

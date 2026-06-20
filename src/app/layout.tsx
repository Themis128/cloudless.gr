import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Work_Sans, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { themeForRoute } from "@/components/ThemeProvider";
import { HubSpotScript } from "@/components/HubSpotScript";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import PlausibleAnalytics from "@/components/PlausibleAnalytics";
import ClarityAnalytics from "@/components/ClarityAnalytics";
import "./globals.css";

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
    "Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing.",
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
  // iOS PWA support — apple-touch-icon + status bar style
  appleWebApp: {
    capable: true,
    title: "Cloudless",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Cloudless — Cloud Computing, Serverless & AI Marketing",
    description:
      "Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing.",
    url: "https://cloudless.gr",
    siteName: "Cloudless",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cloudless — Cloud Computing, Serverless & AI Marketing",
    description:
      "Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing.",
  },
};

// Separated from metadata per Next.js 14+ requirement — avoids deprecation
// warning and ensures <meta name="theme-color"> + viewport-fit are emitted.
export const viewport: Viewport = {
  themeColor: "#0a7785",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>
        <ChunkReloadGuard />
        <HubSpotScript nonce={nonce} />
        {GA_ID ? (
          <>
            {/* Consent Mode v2 — default to denied before user responds to banner.
                Plain <script> + suppressHydrationWarning avoids the dev-only nonce
                attribute mismatch: Next.js renders beforeInteractive nonce on the
                server but the client re-renders it as "" before hydration. */}
            <script
              id="gtag-consent-init"
              nonce={nonce || undefined}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                wait_for_update: 500
              });
            `,
              }}
            />
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
        <PlausibleAnalytics />
        <ClarityAnalytics />
      </body>
    </html>
  );
}

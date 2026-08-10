import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { themeForRoute } from "@/components/ThemeProvider";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import PlausibleAnalytics from "@/components/PlausibleAnalytics";
import ClarityAnalytics from "@/components/ClarityAnalytics";
import WebMCPProvider from "@/components/WebMCPProvider";
import { instrumentSans, workSans, geistMono } from "@/lib/fonts";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

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
  
  // Safely extract locale from pathname
  let locale = routing.defaultLocale; // Default to English
  if (pathname) {
    const pathnameParts = pathname.split("/").filter(Boolean); // Remove empty parts
    if (pathnameParts.length > 0) {
      const firstPart = pathnameParts[0];
      if (routing.locales.includes(firstPart as Locale)) {
        locale = firstPart as Locale;
      }
    }
  }

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
  {GA_ID ? (
    <>
      {/* Modern Google Analytics initialization */}
      <Script
        id="gtag-consent-init"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script
        id="gtag-config"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              // Modern initialization with consent mode
              consent_mode: 'default',
              analytics_storage: 'denied',
              ad_storage: 'denied',
              wait_for_update: 500
            });
          `,
        }}
      />
    </>
  ) : null}
        {children}
        <WebMCPProvider />
        <PlausibleAnalytics />
        <ClarityAnalytics />
      </body>
    </html>
  );
}

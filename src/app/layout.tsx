import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Work_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// ── Viewport (must be a separate export per Next.js 13+) ──────────────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0f",
  colorScheme: "dark",
};

export const metadata: Metadata = {
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
  // ── iOS PWA ────────────────────────────────────────────────────────────
  appleWebApp: {
    capable: true,
    title: "Cloudless",
    statusBarStyle: "black-translucent",
  },
  // Prevent iOS from auto-linking phone number strings
  formatDetection: { telephone: false },
  // Apple touch icon
  icons: {
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Cloudless — Cloud Computing, Serverless & AI Marketing",
    description:
      "Clear skies. Zero friction. Cloud architecture, serverless development, data analytics, and AI-powered marketing for startups and SMBs.",
    url: "https://cloudless.gr",
    siteName: "Cloudless",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cloudless —
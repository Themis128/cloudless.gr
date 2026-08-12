/**
 * Self-hosted font configuration using next/font/local.
 *
 * Font files are stored in src/fonts/ as WOFF2 with Latin-only subsets
 * downloaded from Fontsource (OFL-1.1 licensed):
 *   - Geist Mono (400, 700)           → --font-geist-mono
 *   - Instrument Sans (400, 700)      → --font-instrument-sans
 *   - Work Sans (400, 500, 700)       → --font-work-sans
 *
 * CSS variables match the design tokens defined in globals.css:
 *   --font-heading  → var(--font-instrument-sans)   (headings)
 *   --font-body     → var(--font-work-sans)         (body text)
 *   --font-mono     → var(--font-geist-mono)        (code / terminal)
 */

import localFont from "next/font/local";

const instrumentSans = localFont({
  variable: "--font-instrument-sans",
  src: [
    {
      path: path.resolve(__dirname, "../fonts/instrument-sans.woff2"),
      weight: "400",
      style: "normal",
    },
    {
      path: path.resolve(__dirname, "../fonts/instrument-sans-700.woff2"),
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  // Fallback chain kept for cold-first-render before the font loads.
  fallback: ["system-ui", "sans-serif"],
});

const workSans = localFont({
  variable: "--font-work-sans",
  src: [
    {
      path: path.resolve(__dirname, "../fonts/work-sans.woff2"),
      weight: "400",
      style: "normal",
    },
    {
      path: path.resolve(__dirname, "../fonts/work-sans-500.woff2"),
      weight: "500",
      style: "normal",
    },
    {
      path: path.resolve(__dirname, "../fonts/work-sans-700.woff2"),
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    {
      path: path.resolve(__dirname, "../fonts/geist-mono.woff2"),
      weight: "400",
      style: "normal",
    },
    {
      path: path.resolve(__dirname, "../fonts/geist-mono-700.woff2"),
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monaco", "monospace"],
});

export { instrumentSans, workSans, geistMono };

import { type NextRequest, NextResponse } from "next/server";

/** Serves the PWA web app manifest at /manifest.webmanifest.
 *
 * Exists as an API route + next.config.ts rewrite because Turbopack's dev-mode
 * router matches [locale] before the App Router metadata-file convention
 * (app/manifest.ts), so the metadata route returns a 404 HTML page instead of
 * JSON.  The rewrite intercepts the request here first; app/manifest.ts still
 * generates the <link rel="manifest"> tag in <head>.
 */
export function GET(_req: NextRequest) {
  const manifest = {
    name: "Cloudless \u2014 Cloud Computing, Serverless & AI Marketing",
    short_name: "Cloudless",
    description:
      "Cloud architecture, serverless development, data analytics, and AI-powered marketing for startups and SMBs.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    orientation: "portrait-primary",
    categories: ["business", "technology"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Contact Us",
        short_name: "Contact",
        url: "/contact",
        description: "Book a free 30-minute cloud audit",
      },
      {
        name: "Our Services",
        short_name: "Services",
        url: "/services",
        description: "Cloud, serverless, analytics & AI marketing",
      },
      {
        name: "Read Blog",
        short_name: "Blog",
        url: "/blog",
        description: "Tech insights and guides",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}

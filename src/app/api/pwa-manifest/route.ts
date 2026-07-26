import { type NextRequest, NextResponse } from "next/server";

const MANIFEST = {
  id: "/",
  name: "Cloudless — Cloud Computing, Serverless & AI Marketing",
  short_name: "Cloudless",
  description:
    "Cloud architecture, serverless development, data analytics, and AI-powered marketing for startups and SMBs.",
  start_url: "/?source=pwa",
  scope: "/",
  lang: "en",
  dir: "ltr",
  display: "standalone",
  display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
  background_color: "#fcfcfd",
  theme_color: "#0a7785",
  orientation: "natural",
  prefer_related_applications: false,
  categories: ["business", "technology"],
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Free Cloud Audit",
      short_name: "Audit",
      url: "/contact?source=pwa-shortcut",
      description: "Book a free 30-minute cloud audit",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Our Services",
      short_name: "Services",
      url: "/services",
      description: "Cloud, serverless, analytics & AI marketing",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
    },
    {
      name: "Read Blog",
      short_name: "Blog",
      url: "/blog",
      description: "Tech insights and guides",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
    },
  ],
} as const;

/** Serves the PWA web app manifest at /manifest.webmanifest. */
export function GET(_req: NextRequest) {
  return NextResponse.json(MANIFEST, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}

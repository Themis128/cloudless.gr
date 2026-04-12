import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cloudless — Cloud Computing, Serverless & AI Marketing",
    short_name: "Cloudless",
    description:
      "Cloud architecture, serverless development, data analytics, and AI-powered marketing for startups and SMBs.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    orientation: "any",
    categories: ["business", "technology"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
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
        name: "Contact Us",
        short_name: "Contact",
        url: "/contact",
        description: "Book a free 30-minute cloud audit",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Our Services",
        short_name: "Services",
        url: "/services",
        descript
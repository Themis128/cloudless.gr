import type { MetadataRoute } from "next";

/**
 * robots.txt (Next.js 16 metadata convention).
 *
 * MUST return a `MetadataRoute.Robots` object — NOT a raw `Response`. The
 * framework's internal wrapper reads `rules[].userAgent` from this object;
 * returning a Response crashes prerendering with
 * "Cannot read properties of undefined (reading 'userAgent')".
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/store/success"],
    },
    sitemap: "https://cloudless.gr/sitemap.xml",
    host: "https://cloudless.gr",
  };
}

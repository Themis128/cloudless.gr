import { NextResponse } from "next/server";

/**
 * robots.txt as a literal route (replaces the former MetadataRoute.Robots
 * in src/app/robots.ts). The metadata wrapper can't emit the per-vendor
 * AI-bot groups agent-readiness needs, so we serve the file directly.
 *
 * Policy: AI search + user-triggered fetchers and training crawlers are
 * split into named groups below; public content is indexable for
 * search/answer use while /api/ and checkout-success stay out.
 */

const SEARCH_BOTS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
const USER_FETCHERS = ["ChatGPT-User", "Claude-User", "Perplexity-User"];
const TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
];

// Draft Content-Signal (draft-romm-aipref-contentsignals) and the ARD
// Agentmap pointer were removed — Lighthouse flags every non-standard
// robots.txt directive ("Unknown directive") which fails the robots-txt
// audit and drags SEO below the 0.90 gate. The User-agent groups below
// already enforce the same AI-bot policy via Allow/Disallow.

// Locale-prefixed success pages (/en/store/success, /el/store/success) need the
// wildcard form — "Disallow: /store/success" only matches the non-locale path.
const PRIVATE_RULES = ["Disallow: /api/", "Disallow: /store/success", "Disallow: /*/store/success"];

function group(agents: string[], rules: string[]): string {
  return agents.map((a) => `User-agent: ${a}`).join("\n") + "\n" + rules.join("\n");
}

export function GET() {
  const body = [
    "# Cloudless — crawler + AI-bot rules",
    "# Public content is indexable; /api/ and checkout-success stay out.",
    group(["*"], ["Allow: /", ...PRIVATE_RULES]),
    "",
    "# AI search crawlers — index for AI answers",
    group(SEARCH_BOTS, ["Allow: /", ...PRIVATE_RULES]),
    "",
    "# AI user-triggered fetchers — may fetch pages for user queries",
    group(USER_FETCHERS, ["Allow: /", ...PRIVATE_RULES]),
    "",
    "# AI training crawlers — may crawl; training preference is 'no' below",
    group(TRAINING_BOTS, ["Allow: /", ...PRIVATE_RULES]),
    "",
    "Host: https://cloudless.gr",
    "Sitemap: https://cloudless.gr/sitemap.xml",
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

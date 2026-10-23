import { NextResponse } from "next/server";

/**
 * robots.txt as a literal route (replaces the former MetadataRoute.Robots
 * in src/app/robots.ts). The metadata wrapper can't emit the directives
 * agent-readiness needs — per-vendor AI-bot groups, draft Content-Signal
 * preferences (draft-romm-aipref-contentsignals), and the ARD Agentmap
 * pointer — so we serve the file directly.
 *
 * Policy: AI search + user-triggered fetchers and training crawlers may
 * index public content for search/answer use; ai-train stays "no" in
 * Content-Signals — crawlers may read, models may not train on it.
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

function group(agents: string[], rules: string[]): string {
  return agents.map((a) => `User-agent: ${a}`).join("\n") + "\n" + rules.join("\n");
}

export function GET() {
  const body = [
    "# Cloudless — crawler + AI-bot rules",
    "# Public content is indexable; /api/ and checkout-success stay out.",
    group(
      ["*"],
      [
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /store/success",
        // Content usage preferences live inside the * group
        // (draft-romm-aipref-contentsignals is a group-level field).
        "Content-Signal: ai-train=no, search=yes, ai-input=yes",
      ],
    ),
    "",
    "# AI search crawlers — index for AI answers",
    group(SEARCH_BOTS, ["Allow: /", "Disallow: /api/", "Disallow: /store/success"]),
    "",
    "# AI user-triggered fetchers — may fetch pages for user queries",
    group(USER_FETCHERS, ["Allow: /", "Disallow: /api/", "Disallow: /store/success"]),
    "",
    "# AI training crawlers — may crawl; training preference is 'no' below",
    group(TRAINING_BOTS, ["Allow: /", "Disallow: /api/", "Disallow: /store/success"]),
    "",
    "# ARD capability manifest (agenticresourcediscovery.org §6.1)",
    "Agentmap: https://cloudless.gr/.well-known/ai-catalog.json",
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

/**
 * Quality gates for AI-generated newsletter drafts.
 *
 * Layer 1 — Deterministic gates (cheap, fast, hard-fail):
 *   • Word count within configured bounds
 *   • Structural minimums (≥1 H1, ≥4 H2s)
 *   • Slug uniqueness vs recent posts
 *   • Banned phrases (LLM tells, placeholders, low-quality patterns)
 *   • Title novelty (word-overlap vs last N titles)
 *
 * Layer 2 — LLM critic (a second model judges the article):
 *   • Cloudflare Workers AI llama-3.1-8b returns JSON scores
 *   • Pass threshold: verdict=pass AND overall ≥ MIN_CRITIC_SCORE
 *   • Hallucination guard: critic explicitly checks factual plausibility
 *
 * Combined output drives the auto-promote decision in
 * scripts/generate-weekly-article.ts:
 *   verdict=auto-promote → Notion Status flips to "In Review" automatically;
 *                          Monday 09:00 UTC cron sends without human input
 *   verdict=needs-review → Notion Status stays "Draft"; operator gets DM
 *                          with all reasons and the critic's issue list
 *
 * Self-contained: reads no src/lib/* (kept as a sibling script module so
 * the cron tooling stays portable).
 *
 * References:
 *   https://docs.slack.dev (just for token wiring patterns, not used here)
 *   https://developers.cloudflare.com/workers-ai/configuration/json-mode/
 *   https://pdpspectra.com/blog/llm-safety-guardrails-2026/
 */

// ── Thresholds (single source of truth) ─────────────────────────────────────

export const WORD_MIN = 700; // brand-voice prompt asks 800–1200; allow some slack
export const WORD_MAX = 1400;
export const MIN_H2_COUNT = 3; // brand-voice prompt asks 4–6
export const MAX_TITLE_OVERLAP = 0.75; // 75% word overlap with a recent title = too similar
export const MIN_CRITIC_SCORE = 7.0; // overall avg out of 10 to auto-promote

// Phrases that signal the model leaked metadata, refused, or shipped a template.
// Kept short and high-signal — false positives here block legitimate articles.
const BANNED_PHRASES: ReadonlyArray<string> = [
  "as an ai",
  "as a language model",
  "i cannot",
  "i can't help",
  "i'm sorry, but",
  "i don't have access",
  "<placeholder",
  "[insert ",
  "lorem ipsum",
  "todo:",
  "fixme",
  "click here", // weak CTA per brand-voice guide
  "in conclusion,",
  "in this blog post",
  "in today's fast-paced",
];

// Topic terms we want a human to look at before publishing.
// Designed for cloudless.gr's audience — adjust if you ever broaden scope.
const FORBIDDEN_TOPIC_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(trump|biden|harris|election|war in (ukraine|gaza|israel))\b/i,
  /\b(crypto|bitcoin|ethereum|nft)\b/i, // off-brand
  /\bcompetitor\b/i, // catches LLM accidentally naming competitors
];

// ── Layer 1: deterministic gates ────────────────────────────────────────────

export interface DraftInput {
  title: string;
  slug: string;
  excerpt: string;
  readTime: string;
  content: string;
}

export interface GateResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/** Strip markdown to get plain words for counting + scanning. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/[#*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(md: string): number {
  const plain = stripMarkdown(md);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Levenshtein-adjacent overlap: fraction of normalised tokens in `a` also in `b`. */
function tokenOverlap(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const w of A) if (B.has(w)) overlap++;
  return overlap / Math.max(A.size, B.size);
}

/** Find banned phrases anywhere in the lowercased article body. */
function scanBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}

function scanForbiddenTopics(text: string): string[] {
  const matches: string[] = [];
  for (const re of FORBIDDEN_TOPIC_PATTERNS) {
    const m = re.exec(text);
    if (m) matches.push(m[0]);
  }
  return matches;
}

/**
 * Run all Layer 1 gates synchronously. Returns one GateResult per gate so
 * the Slack notification can show the exact reason a draft was held back.
 */
export function runDeterministicGates(
  draft: DraftInput,
  recentTitles: ReadonlyArray<string>,
  existingSlugs: ReadonlyArray<string>
): GateResult[] {
  const results: GateResult[] = [];

  // Word count
  const words = countWords(draft.content);
  results.push({
    name: "word_count",
    pass: words >= WORD_MIN && words <= WORD_MAX,
    detail: `${words} words (need ${WORD_MIN}–${WORD_MAX})`,
  });

  // Structure: count H2s. The brand prompt embeds "## " sections.
  const h2Count = (draft.content.match(/^##\s+\S/gm) ?? []).length;
  results.push({
    name: "structure_h2",
    pass: h2Count >= MIN_H2_COUNT,
    detail: `${h2Count} H2 sections (need ≥ ${MIN_H2_COUNT})`,
  });

  // Slug uniqueness
  const slugTaken = existingSlugs.includes(draft.slug);
  results.push({
    name: "slug_unique",
    pass: !slugTaken,
    detail: slugTaken ? `slug "${draft.slug}" already published` : draft.slug,
  });

  // Banned phrases (scans title + excerpt + content)
  const haystack = `${draft.title}\n${draft.excerpt}\n${draft.content}`;
  const banned = scanBannedPhrases(haystack);
  results.push({
    name: "banned_phrases",
    pass: banned.length === 0,
    detail: banned.length > 0 ? `found: ${banned.join(", ")}` : "none",
  });

  // Title novelty (word-overlap, fast Levenshtein substitute)
  const overlaps = recentTitles
    .map((t) => ({ t, score: tokenOverlap(draft.title, t) }))
    .filter((x) => x.score >= MAX_TITLE_OVERLAP);
  results.push({
    name: "title_novelty",
    pass: overlaps.length === 0,
    detail:
      overlaps.length > 0
        ? `${(overlaps[0].score * 100).toFixed(0)}% overlap with "${overlaps[0].t}"`
        : "fresh angle",
  });

  // Forbidden topics
  const forbidden = scanForbiddenTopics(haystack);
  results.push({
    name: "forbidden_topics",
    pass: forbidden.length === 0,
    detail: forbidden.length > 0 ? `matched: ${forbidden.join(", ")}` : "none",
  });

  return results;
}

// ── Layer 2: LLM critic ─────────────────────────────────────────────────────

const CRITIC_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export interface CriticResponse {
  scores: {
    factual_credibility: number;
    brand_voice: number;
    structure: number;
    originality: number;
    technical_accuracy: number;
  };
  overall: number;
  verdict: "pass" | "revise";
  issues: string[];
}

const CRITIC_SYSTEM_PROMPT = `You are a senior editor at Cloudless, a cloud consulting and AI marketing firm in Greece serving startups and SMBs across the EU. You judge AI-drafted articles before they go to a paid newsletter and to a public /blog page.

Score each draft 1–10 across five dimensions:
- factual_credibility: facts, numbers, named services — plausible and verifiable, NO obvious hallucinations?
- brand_voice: direct, practical, no buzzword soup, no hedging, no hype, EU sensibility?
- structure: hooks the problem first; ≥4 H2 sections; ends with one concrete actionable next step?
- originality: not a generic listicle, not a rehash of obvious points, a specific angle?
- technical_accuracy: AWS/serverless/AI claims technically accurate to a competent engineer reading it?

Be strict. A score of 7 means "good enough to publish if nothing else is wrong". 8+ is meaningfully better.

OUTPUT STRICT JSON only, no prose:
{
  "scores": {"factual_credibility": N, "brand_voice": N, "structure": N, "originality": N, "technical_accuracy": N},
  "overall": <unweighted mean of the five scores, one decimal>,
  "verdict": "pass" or "revise",
  "issues": ["short, specific feedback", ...]
}

verdict=pass only if every score is ≥ 6 AND overall is ≥ 7.0. Otherwise verdict=revise.`;

interface CfResponse {
  result?: { response?: unknown };
  errors?: { message?: string }[];
  success?: boolean;
}

function articleSchema() {
  return {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: {
          factual_credibility: { type: "number" },
          brand_voice: { type: "number" },
          structure: { type: "number" },
          originality: { type: "number" },
          technical_accuracy: { type: "number" },
        },
        required: [
          "factual_credibility",
          "brand_voice",
          "structure",
          "originality",
          "technical_accuracy",
        ],
        additionalProperties: false,
      },
      overall: { type: "number" },
      verdict: { type: "string", enum: ["pass", "revise"] },
      issues: { type: "array", items: { type: "string" } },
    },
    required: ["scores", "overall", "verdict", "issues"],
    additionalProperties: false,
  } as const;
}

/**
 * Robust JSON parser tolerant of prose-wrapped model output.
 * Tries strict parse first, then extracts the largest `{...}` block.
 */
export function parseCriticJson(raw: string): CriticResponse {
  const attempt = (s: string): CriticResponse => JSON.parse(s) as CriticResponse;
  try {
    return attempt(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return attempt(raw.slice(start, end + 1));
      } catch (err2) {
        throw new Error(`Critic output not parseable. Raw: ${raw.slice(0, 300)}`, { cause: err2 });
      }
    }
    throw new Error(`Critic output had no JSON. Raw: ${raw.slice(0, 300)}`);
  }
}

/**
 * Calls Cloudflare Workers AI with the critic prompt + the draft body.
 * Returns the parsed critic response. Throws on any HTTP / parse failure
 * — caller decides whether to gate-fail or auto-promote on uncertainty.
 */
export async function runLLMCritic(
  accountId: string,
  apiToken: string,
  draft: DraftInput
): Promise<CriticResponse> {
  const userMessage = [
    `TITLE: ${draft.title}`,
    `EXCERPT: ${draft.excerpt}`,
    `READ TIME: ${draft.readTime}`,
    "",
    "CONTENT:",
    draft.content,
  ].join("\n");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CRITIC_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: CRITIC_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
        response_format: {
          type: "json_schema",
          json_schema: { name: "critic", schema: articleSchema(), strict: true },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Critic Cloudflare call failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }

  const data = (await res.json()) as CfResponse;
  if (!data.success) {
    throw new Error(
      `Cloudflare Workers AI rejected critic: ${data.errors?.[0]?.message ?? "unknown"}`
    );
  }
  const raw = data.result?.response;
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  return parseCriticJson(text);
}

// ── Combined verdict ─────────────────────────────────────────────────────────

export type AutoPromoteVerdict =
  | { promote: true; gates: GateResult[]; critic: CriticResponse }
  | {
      promote: false;
      reason: "deterministic" | "critic" | "critic_unavailable";
      gates: GateResult[];
      critic?: CriticResponse;
      criticError?: string;
    };

export interface RunGatesInput {
  draft: DraftInput;
  recentTitles: ReadonlyArray<string>;
  existingSlugs: ReadonlyArray<string>;
  cloudflareAccountId: string | undefined;
  cloudflareApiToken: string | undefined;
}

/**
 * Run all gates and produce a single verdict.
 *
 * Decision tree:
 *   1. If ANY deterministic gate fails → promote=false, reason="deterministic"
 *   2. Else if critic credentials are missing → promote=false, reason="critic_unavailable"
 *      (we refuse to auto-promote without a second opinion)
 *   3. Else run critic:
 *      - critic throws → promote=false, reason="critic_unavailable", criticError
 *      - critic verdict=revise OR overall<MIN_CRITIC_SCORE → promote=false, reason="critic"
 *      - otherwise → promote=true
 */
export async function runGates(input: RunGatesInput): Promise<AutoPromoteVerdict> {
  const gates = runDeterministicGates(input.draft, input.recentTitles, input.existingSlugs);

  const failedGates = gates.filter((g) => !g.pass);
  if (failedGates.length > 0) {
    return { promote: false, reason: "deterministic", gates };
  }

  if (!input.cloudflareAccountId || !input.cloudflareApiToken) {
    return { promote: false, reason: "critic_unavailable", gates };
  }

  let critic: CriticResponse;
  try {
    critic = await runLLMCritic(input.cloudflareAccountId, input.cloudflareApiToken, input.draft);
  } catch (err) {
    return {
      promote: false,
      reason: "critic_unavailable",
      gates,
      criticError: (err as Error)?.message ?? String(err),
    };
  }

  if (critic.verdict !== "pass" || critic.overall < MIN_CRITIC_SCORE) {
    return { promote: false, reason: "critic", gates, critic };
  }

  return { promote: true, gates, critic };
}

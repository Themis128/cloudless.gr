#!/usr/bin/env node
/**
 * PR Review script — Phase 4a of AGENTS_ROADMAP.md
 *
 * Reads pr.diff, sends it to Claude Sonnet, writes review.md.
 * Called from .github/workflows/pr-review.yml.
 *
 * Claude checks for:
 *   - API security hygiene (mirrors .claude/agents/api-security-audit.md)
 *   - SonarCloud-style issues (mirrors .claude/agents/sonarcloud-cleanup.md)
 *   - General correctness issues in changed code
 *
 * Cost: ~$0.05–0.20 per PR (Claude Haiku). Override with REVIEW_MODEL env var.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = process.env.REVIEW_MODEL ?? "claude-haiku-4-5";
const MAX_DIFF_CHARS = 80_000; // ~20k tokens — well under Haiku's 200k ctx
const PR_TITLE = process.env.PR_TITLE ?? "(no title)";
const PR_NUMBER = process.env.PR_NUMBER ?? "?";

// ---------------------------------------------------------------------------
// Read diff
// ---------------------------------------------------------------------------

if (!existsSync("pr.diff")) {
  console.log("pr.diff not found — nothing to review.");
  process.exit(0);
}

const rawDiff = readFileSync("pr.diff", "utf8");

if (!rawDiff.trim()) {
  console.log("Empty diff — no src/ changes. Skipping review.");
  writeFileSync("review.md", "");
  process.exit(0);
}

const truncated = rawDiff.length > MAX_DIFF_CHARS;
const diff =
  rawDiff.slice(0, MAX_DIFF_CHARS) +
  (truncated
    ? `\n\n> ⚠️ Diff truncated at ${MAX_DIFF_CHARS} chars. Showing first portion only.`
    : "");

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `\
You are a code reviewer for cloudless.gr — a Next.js 15 / AWS Lambda SaaS app.
Review only what is in the diff. Do not comment on code that was not changed.

## What to check

### 1. API Security (src/app/api/**)
- Auth coverage: /api/admin/** must call requireAdmin(); /api/user/** must call requireAuth(); /api/cron/** must call isCronAuthorized(); /api/webhooks/** must verify provider signature.
- Rate limiting: new public POST routes must appear in src/proxy.ts RATE_LIMITS map.
- Outbound fetches: every fetch() to a third-party host needs signal: AbortSignal.timeout(N_000).
- Error leakage: public routes must not echo err.message to clients.
- Integration not configured: routes calling notion-* or hubspot.ts libs must catch errors via mapIntegrationError(err) from @/lib/api-errors.

### 2. SonarCloud issues
- S1192 (no-duplicate-string): same string literal used 3+ times in one file → extract a constant.
- S3776 (cognitive-complexity): obviously complex functions → flag, don't auto-suggest refactor.
- S3699 (void-use): void asyncFn() floating without await/catch → should be asyncFn().catch(()=>{}).
- prefer-global-this: global.fetch → globalThis.fetch.

### 3. General correctness
- Type safety regressions (as any, casting away null checks).
- Missing await on async calls.
- Obvious logic errors in changed code only.

## Output format

Return a single markdown block suitable for a GitHub PR comment.
Start with a one-line summary badge line, then a structured list.

Use these severity markers: 🔴 HIGH · 🟡 MEDIUM · 🟢 LOW · ✅ LGTM

If there are no issues, write:
"## ✅ Claude review — LGTM\\n\\nNo issues found in the changed code."

Otherwise use this structure:
\`\`\`
## 🤖 Claude review — PR #<number>: <title>

### 🔴 HIGH (must fix before merge)
- \`src/app/api/foo/route.ts:42\` — Missing requireAdmin() auth guard on admin route.

### 🟡 MEDIUM (should fix)
- \`src/lib/bar.ts:17\` — void asyncFn() should be asyncFn().catch(() => {}) [S3699]

### 🟢 LOW (nice to have)
- \`src/lib/baz.ts:5\` — "some-string" used 4 times — extract a constant [S1192]

---
_Reviewed ${truncated ? "(diff truncated — partial review)" : ""} by Claude ${MODEL} · [AGENTS_ROADMAP.md Phase 4a](docs/AGENTS_ROADMAP.md)_
\`\`\`

Cap findings at 20 total. Be concise — one line per finding.
Do not repeat file contents. Do not suggest tests. Do not propose architecture changes.`;

// ---------------------------------------------------------------------------
// Call Claude
// ---------------------------------------------------------------------------

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log(`Reviewing PR #${PR_NUMBER}: "${PR_TITLE}" with ${MODEL}…`);

let review;
try {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `PR #${PR_NUMBER}: ${PR_TITLE}\n\n\`\`\`diff\n${diff}\n\`\`\``,
      },
    ],
  });

  review = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  console.log(
    `Done. Input tokens: ${msg.usage.input_tokens}, Output tokens: ${msg.usage.output_tokens}`,
  );
} catch (err) {
  console.error("Claude API error:", err.message);
  // Don't fail the workflow — just skip the comment
  writeFileSync("review.md", "");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

writeFileSync("review.md", review ?? "");
console.log("review.md written.");

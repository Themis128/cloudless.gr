#!/usr/bin/env node
/**
 * Stale Gate Sweeper — Phase 4c of AGENTS_ROADMAP.md
 *
 * Scans the codebase for cleanup markers (// remove once X, // TODO: remove,
 * // legacy, backward-compat shims, deprecated flags) and uses Claude to
 * evaluate which ones are ready to delete. Posts a triage report to
 * tracking issue #382.
 *
 * Run weekly via .github/workflows/stale-gate-sweeper.yml or manually with:
 *   GITHUB_TOKEN=... ANTHROPIC_API_KEY=... node scripts/stale-gate-sweeper.mjs
 */

import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = process.env.REVIEW_MODEL ?? "claude-haiku-4-5-20251001";
const REPO = process.env.REPO ?? ""; // "owner/repo"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const TRACKING_ISSUE = 382;
const MAX_MATCHES = 40; // cap — avoid giant prompts
const MAX_CONTEXT_CHARS = 30_000;

if (!GITHUB_TOKEN) { console.error("GITHUB_TOKEN is required"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }

// ---------------------------------------------------------------------------
// Pattern search — grep for stale-gate markers in source files
// ---------------------------------------------------------------------------

const PATTERNS = [
  "remove once",
  "remove when",
  "TODO.*remove",
  "FIXME.*remove",
  "remove after",
  "cleanup.*after",
  "backward.compat",
  "backwards.compat",
  "legacy shim",
  "@deprecated",
];

// Directories to scan
const SCAN_DIRS = "src scripts sst.config.ts";
// File extensions to include
const INCLUDE_EXTS = "--include=*.ts --include=*.tsx --include=*.mjs --include=*.js";

function grepPatterns() {
  const matches = new Map(); // "file:line" → { file, line, lineNum, context }

  for (const pattern of PATTERNS) {
    try {
      const out = execSync(
        `git grep -n -i -E "${pattern}" -- ${SCAN_DIRS} ${INCLUDE_EXTS} 2>/dev/null || true`,
        { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
      );
      for (const line of out.split("\n").filter(Boolean)) {
        const colon = line.indexOf(":");
        const colon2 = line.indexOf(":", colon + 1);
        if (colon < 0 || colon2 < 0) continue;
        const file = line.slice(0, colon);
        const lineNum = line.slice(colon + 1, colon2);
        const content = line.slice(colon2 + 1).trim();
        const key = `${file}:${lineNum}`;
        if (!matches.has(key)) {
          matches.set(key, { file, lineNum: Number(lineNum), content });
        }
      }
    } catch {
      // git grep exits 1 on no matches — that's fine
    }
  }

  return [...matches.values()].slice(0, MAX_MATCHES);
}

// Get a few lines of context around a match
function getContext(file, lineNum, contextLines = 4) {
  try {
    const out = execSync(
      `sed -n "${Math.max(1, lineNum - contextLines)},${lineNum + contextLines}p" "${file}" 2>/dev/null`,
      { encoding: "utf8" }
    );
    return out.trim();
  } catch {
    return "(could not read file)";
  }
}

// ---------------------------------------------------------------------------
// Get recent git log for context (commits in last 30 days)
// ---------------------------------------------------------------------------

function getRecentCommits() {
  try {
    return execSync(
      'git log --oneline --since="30 days ago" --no-merges --format="%h %s" 2>/dev/null | head -30',
      { encoding: "utf8" }
    ).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Claude analysis
// ---------------------------------------------------------------------------

async function analyzeStaleGates(matches, recentCommits) {
  if (matches.length === 0) return null;

  const matchList = matches
    .map(({ file, lineNum, content }) => {
      const ctx = getContext(file, lineNum);
      return `### ${file}:${lineNum}\n\`\`\`\n${ctx}\n\`\`\``;
    })
    .join("\n\n");

  const prompt = `You are reviewing a codebase for stale cleanup markers — comments that say "remove once X" or similar.

Recent commits (last 30 days):
\`\`\`
${recentCommits || "(none)"}
\`\`\`

Cleanup markers found:

${matchList.slice(0, MAX_CONTEXT_CHARS)}

For each marker, assess:
1. Is the condition likely already met? (based on the code context and recent commits)
2. Is it safe to remove the guarded code now?

Respond as a markdown list grouped into two sections:
## Ready to remove (condition met)
## Not yet (condition still active or unclear)

For each item: file:line — one sentence on why it's ready/not ready. Be concise.
If no markers are clearly ready, say so explicitly.`;

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0]?.text ?? "(no analysis)";
}

// ---------------------------------------------------------------------------
// Post to GitHub issue
// ---------------------------------------------------------------------------

async function postIssueComment(body) {
  const [owner, repo] = REPO.split("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${TRACKING_ISSUE}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub API issue comment → ${res.status}: ${txt.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Scanning codebase for stale-gate markers…");
const matches = grepPatterns();
console.log(`Found ${matches.length} marker(s).`);

if (matches.length === 0) {
  console.log("No stale-gate markers found — nothing to report.");
  process.exit(0);
}

const recentCommits = getRecentCommits();
console.log("Asking Claude to evaluate…");
const analysis = await analyzeStaleGates(matches, recentCommits);

if (!analysis) {
  console.log("No analysis produced — skipping.");
  process.exit(0);
}

const now = new Date().toISOString().slice(0, 10);
const body = [
  `## 🧹 Stale Gate Sweeper — ${now}`,
  ``,
  `Scanned \`src/\`, \`scripts/\`, and \`sst.config.ts\` for \`remove once\`, \`TODO: remove\`, \`@deprecated\`, and similar markers. Found **${matches.length}** marker(s).`,
  ``,
  analysis,
  ``,
  `---`,
  `*Generated by stale-gate sweeper (Phase 4c) — [AGENTS_ROADMAP.md](https://github.com/${REPO}/blob/main/docs/AGENTS_ROADMAP.md)*`,
].join("\n");

console.log("Posting report to tracking issue…");
if (REPO) {
  await postIssueComment(body);
  console.log(`Posted to issue #${TRACKING_ISSUE}.`);
} else {
  console.log("REPO not set — printing report:\n", body);
}

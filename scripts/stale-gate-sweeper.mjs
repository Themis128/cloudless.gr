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
// Anthropic SDK is loaded lazily so the script can still run on hosts
// without the npm package installed (heuristic path). See loadAnthropic().
let _Anthropic = null;
async function loadAnthropic() {
  if (_Anthropic) return _Anthropic;
  try {
    const mod = await import("@anthropic-ai/sdk");
    _Anthropic = mod.default || mod;
    return _Anthropic;
  } catch {
    return null;
  }
}

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
// ANTHROPIC_API_KEY is OPTIONAL. Without it (or when the key is unfunded),
// we fall back to a deterministic heuristic — see classifyHeuristic() below.
const HAS_ANTHROPIC = Boolean(ANTHROPIC_API_KEY);

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

// Heuristic classifier — runs without any LLM call. Buckets each marker by:
//   - "blame age" (days since the line was last touched)
//   - whether the comment names a condition (e.g. "after vN", "once X ships")
//     vs. an open TODO with no condition.
// Markers older than HEURISTIC_AGE_DAYS with a named condition are surfaced as
// "ready to review". Younger or vague ones go in "still active / unclear".
const HEURISTIC_AGE_DAYS = 60;

function blameAgeDays(file, lineNum) {
  try {
    const blame = execSync(
      `git blame -L ${lineNum},${lineNum} --porcelain "${file}" 2>/dev/null | head -2`,
      { encoding: "utf8" }
    );
    const m = blame.match(/^author-time (\d+)/m);
    if (!m) return null;
    const ageSec = Math.floor(Date.now() / 1000) - Number(m[1]);
    return Math.floor(ageSec / 86400);
  } catch {
    return null;
  }
}

function classifyHeuristic(matches) {
  const ready = [];
  const stillActive = [];
  for (const m of matches) {
    const age = blameAgeDays(m.file, m.lineNum);
    const ageStr = age == null ? "?" : `${age}d`;
    const namesCondition =
      /\b(once|after|when|until|v\d+|vN|ships?|landed|merged|deployed|migration|launched|GA|Phase \d+)\b/i.test(m.content);
    const isOld = age != null && age >= HEURISTIC_AGE_DAYS;
    const entry = `- \`${m.file}:${m.lineNum}\` *(${ageStr} old)* — ${m.content.replace(/\s+/g, " ").slice(0, 140)}`;
    if (isOld && namesCondition) ready.push(entry);
    else stillActive.push(entry);
  }
  return { ready, stillActive };
}

function heuristicReport(matches) {
  const { ready, stillActive } = classifyHeuristic(matches);
  const sections = [];
  sections.push("## Ready to review (named condition, ≥60d old)");
  sections.push(ready.length ? ready.join("\n") : "_(none — nothing this scan looks confidently ready to delete)_");
  sections.push("");
  sections.push("## Still active or unclear");
  sections.push(stillActive.length ? stillActive.slice(0, 30).join("\n") : "_(none)_");
  if (stillActive.length > 30) {
    sections.push("");
    sections.push(`_…and ${stillActive.length - 30} more not shown_`);
  }
  return sections.join("\n");
}

async function analyzeStaleGates(matches, recentCommits) {
  if (matches.length === 0) return null;

  const matchList = matches
    .map(({ file, lineNum }) => {
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

  if (!HAS_ANTHROPIC) {
    console.log("ANTHROPIC_API_KEY not set — using deterministic heuristic only.");
    return heuristicReport(matches) + "\n\n_Generated by heuristic (no LLM available)._";
  }

  try {
    const A = await loadAnthropic();
    if (!A) {
      console.log("@anthropic-ai/sdk not installed — falling back to heuristic.");
      return heuristicReport(matches) + "\n\n_LLM SDK not installed; generated by heuristic._";
    }
    const client = new A({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content[0]?.text ?? "(no analysis)";
  } catch (err) {
    const m = err?.error?.error?.message || err?.message || String(err);
    console.log(`Anthropic call failed (${m.slice(0, 120)}) — falling back to heuristic.`);
    return heuristicReport(matches) + `\n\n_LLM analysis unavailable (${m.slice(0, 80)}); generated by heuristic._`;
  }
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

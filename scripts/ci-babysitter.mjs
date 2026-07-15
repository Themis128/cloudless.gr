#!/usr/bin/env node
/**
 * CI Failure Babysitter — Phase 5 of AGENTS_ROADMAP.md
 *
 * Fetches failed job logs from a GitHub Actions workflow run, sends them to
 * Claude for root-cause analysis, and posts a comment to the associated PR.
 * Also supports JSON output for agentic workflows.
 *
 * Called from .github/workflows/ci-babysitter-agentic.yml on workflow_run failure.
 *
 * Cost: ~$0.02–0.08 per failure (Claude Haiku). Uses the same OIDC →
 * ANTHROPIC_API_KEY SSM pattern as pr-review.yml.
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = process.env.REVIEW_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_LOG_CHARS = 40_000;
const TRACKING_ISSUE = 382;

const WORKFLOW_NAME = process.env.WORKFLOW_NAME ?? "(unknown workflow)";
const RUN_ID = process.env.RUN_ID ?? "";
const REPO = process.env.REPO ?? ""; // "owner/repo"
const HEAD_BRANCH = process.env.HEAD_BRANCH ?? "";
const HEAD_SHA = process.env.HEAD_SHA ?? "";
const PR_NUMBER = process.env.PR_NUMBER ?? ""; // empty when not from a PR
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

if (!GITHUB_TOKEN) { console.error("GITHUB_TOKEN is required"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
if (!RUN_ID || !REPO) { console.error("RUN_ID and REPO are required"); process.exit(1); }

const [owner, repo] = REPO.split("/");

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function ghFetch(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...opts.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

async function getFailedJobs() {
  const res = await ghFetch(`/repos/${owner}/${repo}/actions/runs/${RUN_ID}/jobs`);
  const data = await res.json();
  return (data.jobs ?? []).filter((j) => j.conclusion === "failure");
}

async function getJobLogs(jobId) {
  try {
    // GitHub returns a redirect to the log download URL
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!res.ok) return `(log fetch failed: ${res.status})`;
    return await res.text();
  } catch (e) {
    return `(log fetch error: ${e.message})`;
  }
}

async function postPrComment(prNumber, body) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

// ---------------------------------------------------------------------------
// Find PR number from branch
// ---------------------------------------------------------------------------

async function findPrForBranch(branch) {
  if (PR_NUMBER) return Number(PR_NUMBER);
  if (!branch || branch === "main") return null;
  try {
    const res = await ghFetch(
      `/repos/${owner}/${repo}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=open&per_page=1`
    );
    const prs = await res.json();
    return prs[0]?.number ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Truncate logs to stay within model context
// ---------------------------------------------------------------------------

function truncateLogs(logs) {
  if (logs.length <= MAX_LOG_CHARS) return logs;
  const half = MAX_LOG_CHARS / 2;
  return (
    logs.slice(0, half) +
    `\n\n[... ${logs.length - MAX_LOG_CHARS} chars truncated ...]\n\n` +
    logs.slice(-half)
  );
}

// ---------------------------------------------------------------------------
// Claude analysis
// ---------------------------------------------------------------------------

async function analyzeFailure(jobName, logs) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `You are a CI diagnosis assistant for a Next.js project (cloudless.gr).
Analyze the GitHub Actions log excerpt and respond in this exact format:

**Root cause:** One sentence describing the error.

**Fix:** Concrete, actionable 1–3 step fix (code change, env var, config, etc.).

**Confidence:** High / Medium / Low — with a brief reason.

Be specific and concise. Do not explain what CI is. Focus on the actionable fix.`,
    messages: [
      {
        role: "user",
        content: `Workflow: ${WORKFLOW_NAME}\nJob: ${jobName}\nBranch: ${HEAD_BRANCH}\nSHA: ${HEAD_SHA}\n\nFailed log:\n\`\`\`\n${truncateLogs(logs)}\n\`\`\``,
      },
    ],
  });
  return msg.content[0]?.text ?? "(no analysis)";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const failedJobs = await getFailedJobs();
if (failedJobs.length === 0) {
  console.log("No failed jobs found — nothing to diagnose.");
  process.exit(0);
}

const analyses = [];
for (const job of failedJobs.slice(0, 3)) { // cap at 3 jobs
  console.log(`Fetching logs for job: ${job.name} (${job.id})`);
  const logs = await getJobLogs(job.id);
  let analysis;
  try {
    analysis = await analyzeFailure(job.name, logs);
  } catch (e) {
    if (e?.status === 401 || e?.type === "authentication_error") {
      console.warn("ANTHROPIC_API_KEY is invalid or expired — skipping AI analysis.");
      process.exit(0);
    }
    throw e;
  }
  analyses.push({ name: job.name, url: job.html_url, analysis });
}

const prNumber = await findPrForBranch(HEAD_BRANCH);
const runUrl = `https://github.com/${REPO}/actions/runs/${RUN_ID}`;

// Output JSON for agentic workflows if --json flag
if (process.argv.includes("--json")) {
  // Extract the first analysis's content for the agentic workflow format
  const firstAnalysis = analyses[0]?.analysis || "";
  let rootCause = "Unknown failure";
  let fix = "No fix suggested";
  let confidence = "Unknown";

  // Parse the analysis text to extract root_cause, fix, confidence
  const rcMatch = firstAnalysis.match(/\*\*Root cause:\*\*\s*(.+?)(?:\n\n|\n\*\*)/i);
  const fixMatch = firstAnalysis.match(/\*\*Fix:\*\*\s*(.+?)(?:\n\n|\n\*\*)/i);
  const confMatch = firstAnalysis.match(/\*\*Confidence:\*\*\s*(.+?)(?:\n\n|\n\*|\n$)/i);

  if (rcMatch) rootCause = rcMatch[1].trim();
  if (fixMatch) fix = fixMatch[1].trim();
  if (confMatch) confidence = confMatch[1].trim();

  const jsonOutput = {
    run_id: RUN_ID,
    workflow: WORKFLOW_NAME,
    branch: HEAD_BRANCH,
    sha: HEAD_SHA,
    pr_number: prNumber || null,
    root_cause: rootCause,
    fix: fix,
    confidence: confidence,
    run_url: runUrl,
  };
  console.log(JSON.stringify(jsonOutput));
  process.exit(0);
}

const body = [
  `## 🔍 CI Failure Diagnosis — ${WORKFLOW_NAME}`,
  ``,
  `**Run:** [${RUN_ID}](${runUrl}) | **Branch:** \`${HEAD_BRANCH}\` | **SHA:** \`${HEAD_SHA.slice(0, 7)}\``,
  ``,
  ...analyses.flatMap(({ name, url, analysis }) => [
    `### Job: [${name}](${url})`,
    ``,
    analysis,
    ``,
  ]),
  `---`,
  `*Generated by CI babysitter (Phase 5) — Agentic Mode*`,
].join("\n");

if (prNumber) {
  console.log(`Posting diagnosis to PR #${prNumber}`);
  await postPrComment(prNumber, body);
} else {
  console.log(`No PR found — posting to tracking issue #${TRACKING_ISSUE}`);
  await postPrComment(TRACKING_ISSUE, body);
}

console.log("Done.");
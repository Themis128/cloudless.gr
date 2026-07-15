#!/usr/bin/env node
/**
 * Create Auto-Fix Issue — helper script for ci-babysitter-agentic.yml
 *
 * Reads diagnosis.json and creates a GitHub issue for Copilot coding agent
 * to auto-fix CI failures.
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const diagnosisPath = "diagnosis.json";
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || "Unknown";
const HEAD_BRANCH = process.env.HEAD_BRANCH || "";
const HEAD_SHA = process.env.HEAD_SHA || "";
const PR_NUMBER = process.env.PR_NUMBER || "";

if (!existsSync(diagnosisPath)) {
  console.log("No diagnosis.json found — skipping issue creation.");
  process.exit(0);
}

const diagnosis = JSON.parse(readFileSync(diagnosisPath, "utf8"));
const rootCause = diagnosis.root_cause || "Unknown failure";
const fix = diagnosis.fix || "No fix suggested";
const confidence = diagnosis.confidence || "Unknown";

const body = `## Agentic CI Fix: ${WORKFLOW_NAME}

**Root Cause:** ${rootCause}

**Suggested Fix:** ${fix}

**Confidence:** ${confidence}

**Context:**
- Workflow: ${WORKFLOW_NAME}
- Branch: \`${HEAD_BRANCH}\`
- SHA: \`${HEAD_SHA}\`
- PR: #${PR_NUMBER || 'N/A'}

**Auto-fix instructions for GitHub Copilot:**
Please analyze the failure and propose a patch. Use the CodingAgent pattern:
1. Review the affected files in \`src/\`, \`scripts/\`, or \`infrastructure/\`
2. Create a minimal, targeted fix
3. Run \`pnpm lint && pnpm typecheck && pnpm build\` to verify
4. Push to a branch and create a PR

/cc @copilot-for-github-actions
`;

const cmd = [
  "gh", "issue", "create",
  "--title", `Auto-fix: ${WORKFLOW_NAME} failure on ${HEAD_BRANCH}`,
  "--body", body,
  "--label", "auto-fix",
  "--label", "agentic-ci"
];

try {
  const result = execSync(cmd.join(" "), { encoding: "utf8" });
  const issueUrl = result.trim();
  console.log(`Created auto-fix issue: ${issueUrl}`);
  const match = issueUrl.match(/\/issues\/(\d+)/);
  if (match) {
    console.log(`ISSUE_NUMBER=${match[1]}`);
  }
} catch (e) {
  console.log(`Failed to create issue: ${e.message}`);
  console.log("ISSUE_NUMBER=");
}
#!/usr/bin/env node
/**
 * Post Diagnosis to PR — helper script for ci-babysitter-agentic.yml
 *
 * Reads diagnosis.json and posts a comment to the PR.
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const diagnosisPath = "diagnosis.json";
const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
  console.log("No PR_NUMBER provided — skipping PR comment.");
  process.exit(0);
}

if (!existsSync(diagnosisPath)) {
  console.log("No diagnosis.json found — skipping PR comment.");
  process.exit(0);
}

let diagnosis;
try {
  diagnosis = JSON.parse(readFileSync(diagnosisPath, "utf8"));
} catch {
  diagnosis = { root_cause: "Unknown", fix: "No fix suggested", confidence: "Unknown" };
}

const body = `## CI Failure Diagnosis

Root cause: ${diagnosis.root_cause || 'Unknown'}

Fix: ${diagnosis.fix || 'No fix suggested'}

Confidence: ${diagnosis.confidence || 'Unknown'}

Auto-fix issue created - GitHub Copilot will investigate.`;

try {
  execSync(`gh pr comment ${prNumber} --body '${body}'`, { stdio: "inherit" });
} catch (e) {
  console.log("Could not post PR comment:", e.message);
}
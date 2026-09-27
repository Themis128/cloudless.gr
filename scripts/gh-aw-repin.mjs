/**
 * Re-apply `continue-on-error: true` to the compiled `agent` job in every
 * .github/workflows/*.lock.yml whose .md frontmatter pins it under
 * `jobs.agent.continue-on-error`.
 *
 * gh-aw ignores `jobs.agent.*` when emitting its built-in agent job, so a
 * plain `gh aw compile` silently strips the pin. The .md sources document
 * the intent ("keep the workflow green when the AI engine fails — quota,
 * partial_execution, infra"); this script restores it post-compile.
 *
 * Usage: node scripts/gh-aw-repin.mjs   (or: make gh-aw-compile)
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const WF_DIR = ".github/workflows";

/** Extract frontmatter (between the first pair of --- lines). */
function frontmatter(mdPath) {
	const text = readFileSync(mdPath, "utf8");
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1] : "";
}

/** True when frontmatter pins continue-on-error under jobs.agent. */
function pinsAgentContinueOnError(fm) {
	// jobs: subtree = consecutive lines indented ≥1 space.
	const jobsBlock = fm.match(/^jobs:\r?\n((?:^[ \t]+[^\n]*(?:\r?\n|$))*)/m);
	if (!jobsBlock) return false;
	// agent: subtree = consecutive lines indented ≥4 spaces.
	const agentBlock = jobsBlock[1].match(
		/^  agent:\r?\n((?:^[ \t]{4,}[^\n]*(?:\r?\n|$))*)/m
	);
	if (!agentBlock) return false;
	return /continue-on-error:\s*true/.test(agentBlock[1]);
}

/** Insert continue-on-error into the `agent:` job if missing. */
function patchLock(lockPath) {
	const lines = readFileSync(lockPath, "utf8").split("\n");
	const agentIdx = lines.findIndex((l) => l === "  agent:");
	if (agentIdx === -1) return "no-agent-job";

	// Find the job's header region (before its first `steps:` or nested key
	// boundary) and check for an existing pin.
	const nextJobIdx = lines.findIndex((l, i) => i > agentIdx && /^  \S/.test(l));
	const end = nextJobIdx === -1 ? lines.length : nextJobIdx;
	const jobHeader = lines.slice(agentIdx, end);
	if (jobHeader.some((l) => /^    continue-on-error:/.test(l))) return "already";

	// Insert right after the job key, keeping comment lines directly under it
	// above the pin for readability: insert before `needs:`/`if:`/`runs-on:` —
	// i.e. as the first concrete field of the job.
	let insertAt = agentIdx + 1;
	while (
		insertAt < end &&
		(lines[insertAt].startsWith("    #") || lines[insertAt].trim() === "")
	) {
		insertAt += 1;
	}
	lines.splice(
		insertAt,
		0,
		"    # Keep the workflow green when the Copilot CLI agent itself fails",
		"    # (quota, partial_execution, infra) — the .md source documents this pin.",
		"    continue-on-error: true"
	);
	writeFileSync(lockPath, lines.join("\n"));
	return "patched";
}

let patched = 0;
let skipped = 0;
for (const file of readdirSync(WF_DIR)) {
	if (!file.endsWith(".md") || file === "README.md") continue;
	const mdPath = join(WF_DIR, file);
	if (!pinsAgentContinueOnError(frontmatter(mdPath))) continue;
	const lockPath = join(WF_DIR, file.replace(/\.md$/, ".lock.yml"));
	const result = patchLock(lockPath);
	if (result === "patched") {
		patched += 1;
		console.log(`patched ${file} → continue-on-error on jobs.agent`);
	} else {
		skipped += 1;
		console.log(`skipped ${file} (${result})`);
	}
}
console.log(`done — ${patched} patched, ${skipped} already pinned/ok`);

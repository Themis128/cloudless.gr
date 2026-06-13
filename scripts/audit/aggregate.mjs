#!/usr/bin/env node
/**
 * Audit aggregator.
 *
 * For each tracked audit workflow, look up the most recent successful run
 * via the GitHub REST API, download its `audit-report` artifact, and
 * synthesize a single dashboard JSON + Markdown.
 *
 * Authenticates with GH_TOKEN. Designed for `actions: read` scope.
 *
 * Usage:
 *   node scripts/audit/aggregate.mjs --repo owner/repo --out-dir audit-report
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
}
const repo = flags.repo || process.env.GITHUB_REPOSITORY;
const outDir = flags["out-dir"] || "audit-report";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!repo || !token) {
  console.error("Missing --repo or GH_TOKEN");
  process.exit(2);
}

await mkdir(outDir, { recursive: true });

// Each audit declares: workflow file, key artifact name pattern, parser.
const AUDITS = [
  {
    key: "lighthouse",
    name: "Lighthouse",
    workflow: "lighthouse.yml",
    artifactPrefix: "lighthouse-report-",
    keyFile: "lighthouse-medians.json",
    parse: (raw) => {
      const medians = JSON.parse(raw);
      const rows = medians.map((m) => ({
        url: m.url,
        perf: Math.round(m.perf * 100),
        a11y: Math.round(m.a11y * 100),
        bp: Math.round(m.bp * 100),
        seo: Math.round(m.seo * 100),
      }));
      return {
        ok: rows.every((r) => r.perf >= 60 && r.a11y >= 90 && r.bp >= 90 && r.seo >= 90),
        rows,
      };
    },
  },
  {
    key: "a11yLive",
    name: "A11y Live",
    workflow: "a11y-live-audit.yml",
    artifactPrefix: "a11y-live-report-",
    keyFile: "a11y-live.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      const rows = data.results.map((r) => ({
        route: r.route,
        total: r.violations.length,
        critical: r.violations.filter((v) => v.impact === "critical").length,
        serious: r.violations.filter((v) => v.impact === "serious").length,
        error: r.error,
      }));
      return {
        ok: rows.every((r) => !r.error && r.critical + r.serious === 0),
        rows,
      };
    },
  },
  {
    key: "securityHeaders",
    name: "Security Headers",
    workflow: "security-headers-audit.yml",
    artifactPrefix: "security-headers-report-",
    keyFile: "security-headers.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      const rows = data.results.map((r) => ({
        url: r.url,
        score: r.score,
        grade: r.grade,
        error: r.error,
      }));
      return {
        ok: rows.every((r) => !r.error && /^[AB]/.test(r.grade)),
        rows,
      };
    },
  },
  {
    key: "depsDrift",
    name: "Deps Drift",
    workflow: "deps-drift-audit.yml",
    artifactPrefix: "deps-drift-report-",
    keyFile: "deps-drift.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      return {
        ok: data.vulnerabilities.summary.critical + data.vulnerabilities.summary.high === 0,
        summary: {
          outdated: data.outdated.total,
          majorDrift: data.outdated.bySeverity.major,
          critical: data.vulnerabilities.summary.critical,
          high: data.vulnerabilities.summary.high,
        },
      };
    },
  },
  {
    key: "linksAudit",
    name: "Links Audit",
    workflow: "links-audit.yml",
    artifactPrefix: "links-report-",
    keyFile: "links.json",
    parse: (raw) => {
      try {
        const data = JSON.parse(raw);
        return { ok: (data.broken ?? 0) === 0, summary: data };
      } catch {
        return { ok: null, summary: null, note: "no machine-readable report" };
      }
    },
    optional: true,
  },
  {
    key: "bundleBudget",
    name: "Bundle Budget",
    workflow: "bundle-budget.yml",
    artifactPrefix: null, // bundle-budget doesn't publish an artifact (yet)
    parse: () => ({ ok: null, note: "Runs on PR only; no artifact published" }),
  },
  {
    key: "coreWebVitals",
    name: "Core Web Vitals",
    workflow: "core-web-vitals-audit.yml",
    artifactPrefix: "cwv-report-",
    keyFile: "cwv.json",
    optional: true,
    parse: (raw) => {
      try {
        return { ok: true, summary: JSON.parse(raw) };
      } catch {
        return { ok: null, note: "no machine-readable report" };
      }
    },
  },
];

/** Helper: call gh REST API with auth. */
async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      "User-Agent": "audits-aggregator/1.0",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GH API ${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

/** Find the most-recent successful run of a workflow. */
async function latestRun(workflow) {
  const data = await gh(
    `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=5&status=success`,
  );
  const runs = data.workflow_runs ?? [];
  return runs[0] ?? null;
}

/** Download the artifact zip and unpack the named file. */
async function fetchArtifact(runId, prefix, fileName) {
  const list = await gh(`/repos/${repo}/actions/runs/${runId}/artifacts`);
  const art = (list.artifacts ?? []).find((a) => a.name.startsWith(prefix));
  if (!art) return null;
  const zipRes = await fetch(art.archive_download_url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "audits-aggregator/1.0" },
    redirect: "follow",
  });
  if (!zipRes.ok) throw new Error(`Artifact download ${zipRes.status}`);
  const buf = Buffer.from(await zipRes.arrayBuffer());
  const tmp = `${outDir}/${art.name}.zip`;
  await writeFile(tmp, buf);
  // Use system unzip
  await new Promise((resolve, reject) => {
    const p = spawn("unzip", ["-o", tmp, "-d", `${outDir}/${art.name}`], { stdio: "ignore" });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))));
  });
  // Walk recursively for the keyFile
  const found = await findFile(`${outDir}/${art.name}`, fileName);
  if (!found) return null;
  return readFile(found, "utf8");
}

async function findFile(dir, name) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await findFile(full, name);
      if (sub) return sub;
    } else if (e.name === name) {
      return full;
    }
  }
  return null;
}

// ── Main ──
const dashboard = { generatedAt: new Date().toISOString(), repo, audits: {} };
const md = ["# 📊 Cloudless.gr Audit Dashboard", "", `Generated ${dashboard.generatedAt}`, ""];

md.push("| Audit | Status | Last Run | Detail |");
md.push("|-------|--------|----------|--------|");

for (const a of AUDITS) {
  console.log(`→ ${a.name}`);
  const entry = { name: a.name, workflow: a.workflow, ok: null, lastRun: null, summary: null, note: null };
  try {
    const run = await latestRun(a.workflow);
    if (!run) {
      entry.note = "no successful runs yet";
      dashboard.audits[a.key] = entry;
      md.push(`| ${a.name} | ⚪ unknown | — | ${entry.note} |`);
      continue;
    }
    entry.lastRun = {
      id: run.id,
      sha: run.head_sha.slice(0, 7),
      url: run.html_url,
      at: run.updated_at,
    };
    if (!a.artifactPrefix) {
      const parsed = a.parse("");
      entry.ok = parsed.ok;
      entry.note = parsed.note;
      entry.summary = parsed.summary ?? null;
    } else {
      const raw = await fetchArtifact(run.id, a.artifactPrefix, a.keyFile);
      if (!raw) {
        entry.note = "artifact missing or empty";
      } else {
        const parsed = a.parse(raw);
        entry.ok = parsed.ok;
        entry.summary = parsed.summary ?? parsed.rows ?? null;
        entry.note = parsed.note ?? null;
      }
    }
    const icon = entry.ok === true ? "✅" : entry.ok === false ? "❌" : entry.ok === null ? (a.optional ? "⚪" : "⚠️") : "—";
    const when = entry.lastRun?.at ?? "—";
    const detail = entry.note ?? (entry.summary ? "see artifact" : "—");
    md.push(`| [${a.name}](${entry.lastRun?.url ?? "#"}) | ${icon} | ${when} | ${detail} |`);
  } catch (err) {
    entry.note = String(err?.message ?? err);
    md.push(`| ${a.name} | ⚠️ error | — | ${entry.note} |`);
  }
  dashboard.audits[a.key] = entry;
}

md.push("");
md.push("> Reports retained 30-60 days per audit. Click an audit name above to open the run.");
md.push("> Live page: `/admin/audits` reads the latest `audits-dashboard-*` artifact via REST.");

await writeFile(`${outDir}/dashboard.json`, JSON.stringify(dashboard, null, 2));
await writeFile(`${outDir}/dashboard.md`, md.join("\n") + "\n");
console.log(`\nDashboard → ${outDir}/dashboard.{json,md}`);

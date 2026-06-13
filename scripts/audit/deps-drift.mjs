#!/usr/bin/env node
/**
 * Dependency drift report.
 *
 * Consolidates the outputs of `pnpm outdated --json`, `pnpm audit --json`,
 * and `pnpm licenses list --json --prod` into a single human-readable
 * report (markdown + JSON) suitable for a weekly tracking issue.
 *
 * Usage:
 *   node scripts/audit/deps-drift.mjs \
 *     --outdated outdated.raw.json \
 *     --audit    audit.raw.json \
 *     --licenses licenses.raw.json \
 *     --json     deps-drift.json \
 *     --md       deps-drift.md
 */

import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
}

async function readJson(path) {
  if (!path) return null;
  try {
    const text = await readFile(path, "utf8");
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn(`(could not parse ${path}: ${err.message})`);
    return null;
  }
}

const outdated = await readJson(flags.outdated);
const audit = await readJson(flags.audit);
const licenses = await readJson(flags.licenses);

// ── Outdated ──
// pnpm outdated --format json returns { [pkg]: { current, wanted, latest, ... } }
const outdatedList = [];
if (outdated && typeof outdated === "object") {
  for (const [pkg, info] of Object.entries(outdated)) {
    if (!info) continue;
    outdatedList.push({
      package: pkg,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
      dependent: info.dependent ?? "",
      type: info.dependencyType ?? "",
    });
  }
}
outdatedList.sort((a, b) => a.package.localeCompare(b.package));

// Classify drift severity
function classify(current, latest) {
  if (!current || !latest) return "unknown";
  const c = current.replace(/^[~^]/, "").split(".").map(Number);
  const l = latest.replace(/^[~^]/, "").split(".").map(Number);
  if (c[0] !== l[0]) return "major";
  if (c[1] !== l[1]) return "minor";
  if (c[2] !== l[2]) return "patch";
  return "same";
}

for (const o of outdatedList) {
  o.severity = classify(o.current, o.latest);
}

// ── Audit ──
// pnpm audit --json returns metadata.vulnerabilities { info, low, moderate, high, critical }
let vulnSummary = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
const advisories = [];
if (audit && audit.metadata && audit.metadata.vulnerabilities) {
  vulnSummary = { ...vulnSummary, ...audit.metadata.vulnerabilities };
  vulnSummary.total = Object.values(audit.metadata.vulnerabilities).reduce((a, b) => a + (b || 0), 0);
}
if (audit && audit.advisories) {
  for (const a of Object.values(audit.advisories)) {
    advisories.push({
      module: a.module_name,
      severity: a.severity,
      title: a.title,
      url: a.url,
      patched: a.patched_versions,
    });
  }
}

// ── Licenses ──
// pnpm licenses --json --prod returns { [license]: [{ name, version, ... }] }
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "Unlicense",
  "WTFPL",
  "0BSD",
  "Python-2.0",
  "BlueOak-1.0.0",
]);
const licenseBuckets = {};
const flagged = [];
if (licenses && typeof licenses === "object") {
  for (const [lic, pkgs] of Object.entries(licenses)) {
    licenseBuckets[lic] = Array.isArray(pkgs) ? pkgs.length : 0;
    if (!ALLOWED.has(lic) && lic !== "UNKNOWN") {
      for (const p of pkgs.slice(0, 10)) {
        flagged.push({ package: p.name, version: p.version, license: lic });
      }
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  outdated: {
    total: outdatedList.length,
    bySeverity: {
      major: outdatedList.filter((o) => o.severity === "major").length,
      minor: outdatedList.filter((o) => o.severity === "minor").length,
      patch: outdatedList.filter((o) => o.severity === "patch").length,
    },
    items: outdatedList,
  },
  vulnerabilities: { summary: vulnSummary, advisories },
  licenses: { buckets: licenseBuckets, flagged },
};

if (flags.json) {
  await writeFile(flags.json, JSON.stringify(summary, null, 2));
  console.log(`JSON → ${flags.json}`);
}

if (flags.md) {
  const lines = [];
  lines.push("## 📦 Dependency Drift Report");
  lines.push("");
  lines.push(`Generated ${summary.generatedAt}`);
  lines.push("");

  lines.push("### Outdated packages");
  lines.push("");
  lines.push(
    `Total: **${summary.outdated.total}**  ` +
      `(🔴 major: ${summary.outdated.bySeverity.major}, ` +
      `🟡 minor: ${summary.outdated.bySeverity.minor}, ` +
      `🟢 patch: ${summary.outdated.bySeverity.patch})`,
  );
  lines.push("");
  if (outdatedList.length > 0) {
    lines.push("| Package | Current | Wanted | Latest | Drift |");
    lines.push("|---------|---------|--------|--------|-------|");
    for (const o of outdatedList.slice(0, 40)) {
      const icon = o.severity === "major" ? "🔴" : o.severity === "minor" ? "🟡" : "🟢";
      lines.push(
        `| \`${o.package}\` | ${o.current ?? "—"} | ${o.wanted ?? "—"} | ${o.latest ?? "—"} | ${icon} ${o.severity} |`,
      );
    }
    if (outdatedList.length > 40) {
      lines.push(`| _… and ${outdatedList.length - 40} more_ | | | | |`);
    }
  } else {
    lines.push("_None._");
  }

  lines.push("");
  lines.push("### Security vulnerabilities");
  lines.push("");
  lines.push(
    `Total: **${vulnSummary.total}**  ` +
      `(🔴 critical: ${vulnSummary.critical}, ` +
      `🟠 high: ${vulnSummary.high}, ` +
      `🟡 moderate: ${vulnSummary.moderate}, ` +
      `🟢 low: ${vulnSummary.low})`,
  );
  if (advisories.length > 0) {
    lines.push("");
    lines.push("| Module | Severity | Title | Patched |");
    lines.push("|--------|----------|-------|---------|");
    for (const a of advisories.slice(0, 15)) {
      lines.push(`| \`${a.module}\` | ${a.severity} | [${a.title}](${a.url}) | ${a.patched ?? "—"} |`);
    }
  }

  lines.push("");
  lines.push("### Licenses");
  lines.push("");
  const sortedLicenses = Object.entries(licenseBuckets).sort((a, b) => b[1] - a[1]);
  if (sortedLicenses.length > 0) {
    lines.push("| License | Count |");
    lines.push("|---------|-------|");
    for (const [lic, n] of sortedLicenses.slice(0, 15)) {
      const star = ALLOWED.has(lic) || lic === "UNKNOWN" ? "" : " ⚠️";
      lines.push(`| ${lic}${star} | ${n} |`);
    }
    if (flagged.length > 0) {
      lines.push("");
      lines.push("#### ⚠️ Flagged (non-permissive)");
      lines.push("");
      for (const p of flagged.slice(0, 10)) {
        lines.push(`- \`${p.package}@${p.version}\` — ${p.license}`);
      }
    }
  } else {
    lines.push("_License data unavailable._");
  }

  await writeFile(flags.md, lines.join("\n") + "\n");
  console.log(`Markdown → ${flags.md}`);
}

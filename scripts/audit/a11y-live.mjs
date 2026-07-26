#!/usr/bin/env node
/**
 * Live a11y audit using Playwright + axe-core.
 *
 * Crawls a curated route set against the live (post-CDN) site and reports
 * each route's axe violations grouped by impact. Produces JSON + Markdown.
 *
 * Usage:
 *   node scripts/audit/a11y-live.mjs --base https://cloudless.gr [--json OUT] [--md OUT]
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Live routes audited daily. /el and /en/about are currently 404 and
// excluded — re-add them when those pages ship. 404s aren't a11y problems
// and would pollute the report.
const ROUTES = [
  "/",
  "/en",
  "/en/services",
  "/en/contact",
  "/en/store",
  "/en/blog",
  "/en/case-studies",
];

const args = process.argv.slice(2);
let base = "https://cloudless.gr";
let jsonOut = null;
let mdOut = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--base") base = args[++i];
  else if (a === "--json") jsonOut = args[++i];
  else if (a === "--md") mdOut = args[++i];
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: "cloudless-audit/1.0" });

const results = [];
for (const route of ROUTES) {
  const url = base.replace(/\/$/, "") + route;
  console.log(`→ ${url}`);
  const page = await ctx.newPage();
  let r = { route, url, error: null, violations: [] };
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!resp || !resp.ok()) {
      r.error = `HTTP ${resp ? resp.status() : "no response"}`;
    } else {
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      r.violations = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.length,
        // Capture the first 5 offending node selectors + a short snippet
        // so a follow-up fix session can find the elements without re-running
        // a full crawl. Limited to 5 to keep the report small.
        targets: v.nodes.slice(0, 5).map((n) => ({
          target: Array.isArray(n.target) ? n.target.join(" ") : String(n.target),
          html: (n.html ?? "").slice(0, 200),
        })),
      }));
    }
  } catch (err) {
    r.error = String(err?.message ?? err);
  } finally {
    await page.close();
  }
  results.push(r);
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").length;
  console.log(
    `  ${r.error ? "❌" : serious > 0 ? "⚠️" : "✅"}` +
      ` violations: ${r.violations.length}` +
      (r.error ? `  ${r.error}` : "") +
      (serious > 0 ? ` (${serious} serious/critical)` : ""),
  );
}

await browser.close();

const summary = { generatedAt: new Date().toISOString(), base, results };

if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify(summary, null, 2));
  console.log(`\nJSON → ${jsonOut}`);
}

if (mdOut) {
  const lines = [];
  lines.push("## ♿ A11y Live Audit");
  lines.push("");
  lines.push(`Base: \`${base}\` · generated ${summary.generatedAt}`);
  lines.push("");
  lines.push("| Route | Total | Critical | Serious | Moderate | Minor | Status |");
  lines.push("|-------|-------|----------|---------|----------|-------|--------|");
  for (const r of results) {
    const c = r.violations.filter((v) => v.impact === "critical").length;
    const s = r.violations.filter((v) => v.impact === "serious").length;
    const m = r.violations.filter((v) => v.impact === "moderate").length;
    const mi = r.violations.filter((v) => v.impact === "minor").length;
    const status = r.error ? `❌ ${r.error}` : c + s > 0 ? "⚠️ regression" : "✅";
    lines.push(`| ${r.route} | ${r.violations.length} | ${c} | ${s} | ${m} | ${mi} | ${status} |`);
  }
  lines.push("");
  lines.push("<details><summary>Top violations per route</summary>");
  lines.push("");
  for (const r of results) {
    if (r.error || r.violations.length === 0) continue;
    lines.push(`### ${r.route}`);
    lines.push("");
    for (const v of r.violations.slice(0, 10)) {
      lines.push(`- **${v.impact ?? "n/a"}** \`${v.id}\` — ${v.help} (${v.nodes} nodes) — [docs](${v.helpUrl})`);
    }
    lines.push("");
  }
  lines.push("</details>");
  await writeFile(mdOut, lines.join("\n") + "\n");
  console.log(`Markdown → ${mdOut}`);
}

// Exit 0 — strictness is enforced by the workflow, not the script.
process.exit(0);

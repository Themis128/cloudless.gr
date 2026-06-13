#!/usr/bin/env node
/**
 * Live link health audit.
 *
 * 1. Pulls sitemap.xml from the base URL.
 * 2. Extracts all <loc> URLs (capped at 200 to keep runtime sane).
 * 3. HEAD-probes each one; falls back to GET if HEAD returns 405.
 * 4. Categorizes: ok (2xx), redirect (3xx), client_error (4xx), server_error
 *    (5xx), unreachable (network error), slow (>3s).
 *
 * Usage:
 *   node scripts/audit/link-health.mjs --base https://cloudless.gr [--json OUT] [--md OUT]
 */

import { writeFile } from "node:fs/promises";

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

const SLOW_MS = 3000;
const MAX_URLS = 200;

console.log(`Fetching sitemap from ${base}/sitemap.xml`);
const smRes = await fetch(`${base.replace(/\/$/, "")}/sitemap.xml`, {
  headers: { "user-agent": "cloudless-audit/1.0" },
});
if (!smRes.ok) {
  console.error(`Sitemap fetch failed: HTTP ${smRes.status}`);
  process.exit(1);
}
const xml = await smRes.text();

// Naive extraction — sitemap.xml grammar is tiny.
const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map((m) => m[1]);
console.log(`Found ${locs.length} URLs in sitemap, probing first ${Math.min(locs.length, MAX_URLS)}`);

const sample = locs.slice(0, MAX_URLS);
const out = [];

async function probe(url) {
  const t0 = performance.now();
  let res = null;
  let method = "HEAD";
  try {
    res = await fetch(url, { method: "HEAD", redirect: "manual", headers: { "user-agent": "cloudless-audit/1.0" } });
    if (res.status === 405 || res.status === 501) {
      method = "GET";
      res = await fetch(url, { method: "GET", redirect: "manual", headers: { "user-agent": "cloudless-audit/1.0" } });
    }
  } catch (err) {
    return { url, status: 0, method, ms: Math.round(performance.now() - t0), error: String(err?.message ?? err) };
  }
  return { url, status: res.status, method, ms: Math.round(performance.now() - t0), location: res.headers.get("location") };
}

// Probe in batches of 10 to avoid the origin throttling us
const CONCURRENCY = 10;
for (let i = 0; i < sample.length; i += CONCURRENCY) {
  const batch = await Promise.all(sample.slice(i, i + CONCURRENCY).map(probe));
  out.push(...batch);
  process.stdout.write(`  ${i + batch.length}/${sample.length}\r`);
}
process.stdout.write("\n");

function category(r) {
  if (r.error) return "unreachable";
  if (r.status >= 200 && r.status < 300) return r.ms > SLOW_MS ? "slow" : "ok";
  if (r.status >= 300 && r.status < 400) return "redirect";
  if (r.status >= 400 && r.status < 500) return "client_error";
  if (r.status >= 500) return "server_error";
  return "unknown";
}

const buckets = { ok: 0, slow: 0, redirect: 0, client_error: 0, server_error: 0, unreachable: 0, unknown: 0 };
const problems = [];
for (const r of out) {
  r.category = category(r);
  buckets[r.category]++;
  if (r.category !== "ok") problems.push(r);
}

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  total: out.length,
  broken: buckets.client_error + buckets.server_error + buckets.unreachable,
  buckets,
  problems,
};

if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify(summary, null, 2));
  console.log(`JSON → ${jsonOut}`);
}

if (mdOut) {
  const lines = [];
  lines.push("## 🔗 Link Health Audit");
  lines.push("");
  lines.push(`Base: \`${base}\` · ${out.length} URLs probed · ${summary.broken} broken`);
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|--------|-------|");
  lines.push(`| ✅ OK | ${buckets.ok} |`);
  lines.push(`| 🐌 Slow (>${SLOW_MS}ms) | ${buckets.slow} |`);
  lines.push(`| ↪️ Redirect | ${buckets.redirect} |`);
  lines.push(`| ⚠️ 4xx | ${buckets.client_error} |`);
  lines.push(`| 🔴 5xx | ${buckets.server_error} |`);
  lines.push(`| ❌ Unreachable | ${buckets.unreachable} |`);
  if (problems.length > 0) {
    lines.push("");
    lines.push("### Problems");
    lines.push("");
    lines.push("| URL | Status | Category | Latency | Note |");
    lines.push("|-----|--------|----------|---------|------|");
    for (const p of problems.slice(0, 50)) {
      lines.push(
        `| ${p.url} | ${p.status || "—"} | ${p.category} | ${p.ms}ms | ${
          p.error ? p.error : p.location ? `→ ${p.location}` : ""
        } |`,
      );
    }
    if (problems.length > 50) {
      lines.push(`| _… and ${problems.length - 50} more_ | | | | |`);
    }
  }
  await writeFile(mdOut, lines.join("\n") + "\n");
  console.log(`Markdown → ${mdOut}`);
}

#!/usr/bin/env node
/**
 * Security headers audit.
 *
 * Scores response headers against the Mozilla Observatory rubric (simplified):
 *   strict-transport-security        +20  (max-age >= 15552000 = 6 months)
 *   content-security-policy          +25  (presence) + content checks (-5 each violation)
 *   x-content-type-options:nosniff   +5
 *   x-frame-options OR CSP frame-ancestors  +5
 *   referrer-policy                  +5
 *   permissions-policy               +5
 *   cross-origin-opener-policy       +5
 *   cross-origin-resource-policy     +5
 *   cross-origin-embedder-policy     +5
 *   subresource-integrity (audit hint only — not a header) — N/A
 *
 *  Score 95+: A+, 85+: A, 75+: B, 65+: C, 50+: D, <50: F.
 *
 * Usage:
 *   node scripts/audit/security-headers.mjs URL [URL …] [--json OUT.json] [--md OUT.md]
 *
 * Inputs: any URL list. Outputs: JSON + Markdown side-by-side, both optional.
 */

import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

/**
 * Validate that a user-supplied output path stays inside the current working
 * directory. CodeQL "network data written to file" alerts flag any writeFile
 * whose path could be influenced by external input; constraining writes to
 * the CWD eliminates the path-traversal class of risks even though our flow
 * doesn't take untrusted filenames.
 */
function safeOutPath(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  const abs = resolvePath(p);
  const cwd = resolvePath(process.cwd());
  if (!abs.startsWith(cwd + "/") && abs !== cwd) {
    throw new Error(`Refusing to write outside cwd: ${p}`);
  }
  return abs;
}

const args = process.argv.slice(2);
const urls = [];
let jsonOut = null;
let mdOut = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") {
    jsonOut = args[++i];
  } else if (a === "--md") {
    mdOut = args[++i];
  } else {
    urls.push(a);
  }
}

if (urls.length === 0) {
  console.error("Usage: security-headers.mjs URL [URL …] [--json OUT] [--md OUT]");
  process.exit(2);
}

function gradeFromScore(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function emoji(grade) {
  if (grade === "A+" || grade === "A" || grade === "A-") return "🟢";
  if (grade.startsWith("B")) return "🟡";
  if (grade === "C") return "🟠";
  return "🔴";
}

/**
 * Audit a single URL's response headers and return a graded result.
 */
async function auditUrl(url) {
  const result = {
    url,
    score: 0,
    grade: "F",
    headers: {},
    findings: [],
    error: null,
  };

  let res;
  try {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "cloudless-audit/1.0" },
    });
  } catch (err) {
    result.error = String(err?.message ?? err);
    return result;
  }

  if (res.status >= 400 && res.status !== 401 && res.status !== 403) {
    result.error = `HTTP ${res.status} ${res.statusText}`;
    return result;
  }

  const h = (name) => res.headers.get(name);
  const has = (name) => Boolean(h(name));

  for (const name of [
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "cross-origin-embedder-policy",
    "x-xss-protection",
    "server",
    "x-powered-by",
  ]) {
    const v = h(name);
    if (v) result.headers[name] = v;
  }

  let score = 0;

  // HSTS
  if (has("strict-transport-security")) {
    const hsts = h("strict-transport-security");
    const m = /max-age=(\d+)/i.exec(hsts);
    const maxAge = m ? Number(m[1]) : 0;
    if (maxAge >= 15552000) {
      score += 20;
      result.findings.push({ severity: "ok", header: "strict-transport-security", note: `max-age ${maxAge}s (>= 6mo)` });
    } else {
      score += 10;
      result.findings.push({
        severity: "warn",
        header: "strict-transport-security",
        note: `max-age ${maxAge}s — recommend >= 15552000 (6mo)`,
      });
    }
    if (/includeSubDomains/i.test(hsts)) score += 2;
    if (/preload/i.test(hsts)) score += 3;
  } else {
    result.findings.push({ severity: "error", header: "strict-transport-security", note: "missing" });
  }

  // CSP
  const cspName = has("content-security-policy")
    ? "content-security-policy"
    : has("content-security-policy-report-only")
      ? "content-security-policy-report-only"
      : null;
  if (cspName) {
    score += cspName === "content-security-policy" ? 25 : 15;
    const csp = h(cspName);
    const cspIssues = [];
    // 'unsafe-inline' alone is bad, but 'strict-dynamic' + 'nonce-…' supersedes
    // it in modern browsers (the inline directive becomes a no-op). Only flag
    // 'unsafe-inline' if it is NOT neutralized by 'strict-dynamic' or a nonce.
    const hasStrictDynamic = /'strict-dynamic'/.test(csp);
    const hasNonce = /'nonce-[^']+'/.test(csp);
    if (
      /'unsafe-inline'/.test(csp) &&
      /script-src/.test(csp) &&
      !hasStrictDynamic &&
      !hasNonce
    ) {
      cspIssues.push("script-src allows 'unsafe-inline'");
      score -= 5;
    }
    if (/'unsafe-eval'/.test(csp)) {
      cspIssues.push("'unsafe-eval' present");
      score -= 5;
    }
    if (!/frame-ancestors/.test(csp)) {
      cspIssues.push("missing frame-ancestors");
    }
    for (const note of cspIssues) {
      result.findings.push({ severity: "warn", header: cspName, note });
    }
    if (cspIssues.length === 0) {
      result.findings.push({ severity: "ok", header: cspName, note: "present, no obvious weaknesses" });
    }
  } else {
    result.findings.push({ severity: "error", header: "content-security-policy", note: "missing" });
  }

  // X-Content-Type-Options
  if (h("x-content-type-options") === "nosniff") {
    score += 5;
    result.findings.push({ severity: "ok", header: "x-content-type-options", note: "nosniff" });
  } else {
    result.findings.push({ severity: "warn", header: "x-content-type-options", note: "missing or not nosniff" });
  }

  // Frame-ancestors equivalent
  const xfo = h("x-frame-options");
  if (xfo && /^(DENY|SAMEORIGIN)$/i.test(xfo.trim())) {
    score += 5;
    result.findings.push({ severity: "ok", header: "x-frame-options", note: xfo });
  } else if (cspName && /frame-ancestors/i.test(h(cspName))) {
    score += 5;
    result.findings.push({ severity: "ok", header: "csp frame-ancestors", note: "covers clickjacking" });
  } else {
    result.findings.push({ severity: "warn", header: "x-frame-options", note: "missing (and no CSP frame-ancestors)" });
  }

  // Referrer-Policy
  if (has("referrer-policy")) {
    score += 5;
    result.findings.push({ severity: "ok", header: "referrer-policy", note: h("referrer-policy") });
  } else {
    result.findings.push({ severity: "warn", header: "referrer-policy", note: "missing" });
  }

  // Permissions-Policy
  if (has("permissions-policy")) {
    score += 5;
    result.findings.push({ severity: "ok", header: "permissions-policy", note: "present" });
  } else {
    result.findings.push({ severity: "warn", header: "permissions-policy", note: "missing" });
  }

  // COOP / CORP / COEP
  for (const name of [
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "cross-origin-embedder-policy",
  ]) {
    if (has(name)) {
      score += 5;
      result.findings.push({ severity: "ok", header: name, note: h(name) });
    } else {
      result.findings.push({ severity: "info", header: name, note: "missing (recommended for isolation)" });
    }
  }

  // Penalize leaky server/X-Powered-By
  if (has("server") && /\d/.test(h("server"))) {
    score -= 3;
    result.findings.push({ severity: "warn", header: "server", note: `version leaked: ${h("server")}` });
  }
  if (has("x-powered-by")) {
    score -= 3;
    result.findings.push({ severity: "warn", header: "x-powered-by", note: `revealed: ${h("x-powered-by")}` });
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));
  result.score = score;
  result.grade = gradeFromScore(score);
  return result;
}

const results = [];
for (const url of urls) {
  console.log(`→ ${url}`);
  const r = await auditUrl(url);
  results.push(r);
  console.log(`  ${emoji(r.grade)} ${r.grade} (score ${r.score})${r.error ? `  ⚠️ ${r.error}` : ""}`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  results,
};

const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const MAX_CELL = 300;
const sanitizeCell = (v) => String(v).replace(CTRL_RE, "").slice(0, MAX_CELL);
const escCell = (v) => sanitizeCell(v).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

if (jsonOut) {
  const target = safeOutPath(jsonOut);
  // CodeQL #1780 defense: even the JSON form runs through control-char
  // strip so the same flow guarantee applies regardless of consumer.
  const body = JSON.stringify(summary, null, 2).replace(CTRL_RE, "");
  await writeFile(target, body);
  console.log(`\nJSON → ${jsonOut}`);
}

if (mdOut) {
  // CodeQL #1780 (js/http-to-file-access): the report content is derived
  // from response headers fetched via HTTP. Strip control characters and
  // cap the per-cell length so a hostile header value cannot break out of
  // the markdown context.
  const lines = [];
  lines.push("## 🛡️ Security Headers Audit");
  lines.push("");
  lines.push("| URL | Grade | Score | Notes |");
  lines.push("|-----|-------|-------|-------|");
  for (const r of results) {
    const note = r.error
      ? r.error
      : r.findings
          .filter((f) => f.severity === "error" || f.severity === "warn")
          .slice(0, 3)
          .map((f) => `${f.header}: ${f.note}`)
          .join("; ") || "OK";
    lines.push(
      `| ${escCell(r.url)} | ${escCell(emoji(r.grade))} ${escCell(r.grade)} | ${escCell(r.score)} | ${escCell(note)} |`,
    );
  }
  lines.push("");
  lines.push("<details><summary>Full findings</summary>");
  lines.push("");
  for (const r of results) {
    lines.push(`### ${sanitizeCell(r.url)}`);
    lines.push("");
    for (const f of r.findings) {
      const icon = f.severity === "ok" ? "✅" : f.severity === "warn" ? "⚠️" : f.severity === "error" ? "❌" : "ℹ️";
      lines.push(`- ${icon} **${sanitizeCell(f.header)}** — ${sanitizeCell(f.note)}`);
    }
    lines.push("");
  }
  lines.push("</details>");
  const target = safeOutPath(mdOut);
  const body = lines.join("\n").replace(CTRL_RE, "") + "\n";
  await writeFile(target, body);
  console.log(`Markdown → ${mdOut}`);
}

// Overall exit policy: errors only if every URL failed to fetch
const allFailed = results.every((r) => r.error);
process.exit(allFailed ? 1 : 0);

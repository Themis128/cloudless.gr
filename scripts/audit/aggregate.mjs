#!/usr/bin/env node
/**
 * Audit aggregator. See README; CodeQL #1777/#1779 hardening applied.
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve as resolvePath, basename } from "node:path";

function safeFileName(name) {
  const safe = basename(String(name)).replace(/[\\/]/g, "");
  if (!safe || safe === "." || safe === "..") {
    throw new Error(`Refusing to write artifact with unsafe name: ${name}`);
  }
  return safe;
}

function safeWriteTarget(outDir, ...segments) {
  const root = resolvePath(outDir);
  const target = resolvePath(outDir, ...segments.map((s) => String(s)));
  if (!target.startsWith(root + "/") && target !== root) {
    throw new Error(`Refusing to write outside out-dir: ${segments.join("/")}`);
  }
  return target;
}

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

const AUDITS = [
  { key: "lighthouse", name: "Lighthouse", workflow: "lighthouse.yml",
    artifactPrefix: "lighthouse-report-", keyFile: "lighthouse-medians.json",
    parse: (raw) => {
      const medians = JSON.parse(raw);
      const rows = medians.map((m) => ({
        url: m.url, perf: Math.round(m.perf * 100), a11y: Math.round(m.a11y * 100),
        bp: Math.round(m.bp * 100), seo: Math.round(m.seo * 100),
      }));
      return { ok: rows.every((r) => r.perf >= 60 && r.a11y >= 90 && r.bp >= 90 && r.seo >= 90), rows };
    } },
  { key: "a11yLive", name: "A11y Live", workflow: "a11y-live-audit.yml",
    artifactPrefix: "a11y-live-report-", keyFile: "a11y-live.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      const rows = data.results.map((r) => ({
        route: r.route, total: r.violations.length,
        critical: r.violations.filter((v) => v.impact === "critical").length,
        serious: r.violations.filter((v) => v.impact === "serious").length, error: r.error,
      }));
      return { ok: rows.every((r) => !r.error && r.critical + r.serious === 0), rows };
    } },
  { key: "securityHeaders", name: "Security Headers", workflow: "security-headers-audit.yml",
    artifactPrefix: "security-headers-report-", keyFile: "security-headers.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      const rows = data.results.map((r) => ({ url: r.url, score: r.score, grade: r.grade, error: r.error }));
      return { ok: rows.every((r) => !r.error && /^[AB]/.test(r.grade)), rows };
    } },
  { key: "depsDrift", name: "Deps Drift", workflow: "deps-drift-audit.yml",
    artifactPrefix: "deps-drift-report-", keyFile: "deps-drift.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      return { ok: data.vulnerabilities.summary.critical + data.vulnerabilities.summary.high === 0,
        summary: { outdated: data.outdated.total, majorDrift: data.outdated.bySeverity.major,
          critical: data.vulnerabilities.summary.critical, high: data.vulnerabilities.summary.high } };
    } },
  { key: "linksAudit", name: "Links Audit", workflow: "links-audit.yml",
    artifactPrefix: "links-report-", keyFile: "links.json", optional: true,
    parse: (raw) => { try { const d = JSON.parse(raw); return { ok: (d.broken ?? 0) === 0, summary: d }; }
      catch { return { ok: null, summary: null, note: "no machine-readable report" }; } } },
  { key: "bundleBudget", name: "Bundle Budget", workflow: "bundle-budget.yml",
    artifactPrefix: null,
    parse: () => ({ ok: null, note: "Runs on PR only; no artifact published" }) },
  { key: "coreWebVitals", name: "Core Web Vitals", workflow: "core-web-vitals-audit.yml",
    artifactPrefix: "cwv-report-", keyFile: "cwv.json", optional: true,
    parse: (raw) => { try { return { ok: true, summary: JSON.parse(raw) }; }
      catch { return { ok: null, note: "no machine-readable report" }; } } },
  { key: "clusterStatus", name: "Cluster Status", workflow: "cluster-status-audit.yml",
    artifactPrefix: "cluster-status-report-", keyFile: "cluster.json",
    parse: (raw) => {
      const data = JSON.parse(raw);
      const nodes = data.nodes ?? [];
      const notReady = nodes.filter((n) => n.status !== "Ready").length;
      const runners = data.runners ?? [];
      const offlineRunners = runners.filter((r) => r.status !== "online").length;
      const crashPods = (data.pods ?? []).reduce((acc, ns) =>
        acc + (ns.CrashLoopBackOff ?? 0) + (ns.ImagePullBackOff ?? 0) + (ns.ErrImagePull ?? 0), 0);
      return { ok: data.cluster?.reachable && notReady === 0 && offlineRunners === 0 && crashPods === 0,
        summary: { clusterReachable: data.cluster?.reachable ?? false,
          nodes: nodes.length, nodesReady: nodes.length - notReady,
          runners: runners.length, runnersOnline: runners.length - offlineRunners, crashPods } };
    } },
];

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { "User-Agent": "audits-aggregator/1.0", Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GH API ${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

async function latestRun(workflow) {
  const data = await gh(`/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=5&status=success`);
  return (data.workflow_runs ?? [])[0] ?? null;
}

// CodeQL #1777/#1779 (js/http-to-file-access): bound URL + content-type + size + magic bytes
// before any HTTP-sourced byte reaches writeFile. Lighthouse traces alone run
// ~22 MiB (5 URLs × full trace bundle), so the cap is set to 64 MiB — still
// well below GitHub's 500 MiB per-artifact ceiling.
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const ALLOWED_FETCH_HOSTS = new Set([
  "api.github.com", "objects.githubusercontent.com",
  "pipelines.actions.githubusercontent.com",
]);
function assertSafeFetchUrl(u) {
  const parsed = new URL(u);
  if (parsed.protocol !== "https:") throw new Error(`Refusing non-HTTPS fetch: ${parsed.protocol}`);
  const host = parsed.host.toLowerCase();
  const allowedSuffix = host.endsWith(".githubusercontent.com") || host.endsWith(".blob.core.windows.net");
  if (!ALLOWED_FETCH_HOSTS.has(host) && !allowedSuffix) throw new Error(`Refusing fetch to unallowed host: ${host}`);
  return parsed;
}
async function readBoundedBody(res, maxBytes) {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes (${buf.length})`);
    return buf;
  }
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error(`Response exceeds ${maxBytes} bytes`); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchArtifact(runId, prefix, fileName) {
  const list = await gh(`/repos/${repo}/actions/runs/${runId}/artifacts`);
  const art = (list.artifacts ?? []).find((a) => a.name.startsWith(prefix));
  if (!art) return null;
  assertSafeFetchUrl(art.archive_download_url);
  const zipRes = await fetch(art.archive_download_url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "audits-aggregator/1.0" },
    redirect: "follow",
  });
  if (!zipRes.ok) throw new Error(`Artifact download ${zipRes.status}`);
  const ct = (zipRes.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("zip") && !ct.includes("octet-stream")) {
    throw new Error(`Unexpected artifact content-type: ${ct}`);
  }
  // CodeQL #1802: Intermediate ZIP archive from trusted GitHub artifact sources only
  // (validated by assertSafeFetchUrl + content-type check + magic header).
  // The JSON content is sanitized via stripCtrl before writing to dashboard files.
  const buf = await readBoundedBody(zipRes, MAX_ARTIFACT_BYTES);
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`Artifact does not have a ZIP magic header`);
  }
  const safeName = safeFileName(art.name);
  const tmp = safeWriteTarget(outDir, `${safeName}.zip`);
  await writeFile(tmp, buf);
  const extractDir = safeWriteTarget(outDir, safeName);
  await new Promise((resolve, reject) => {
    const p = spawn("unzip", ["-o", tmp, "-d", extractDir], { stdio: "ignore" });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))));
  });
  const found = await findFile(extractDir, fileName);
  if (!found) return null;
  return readFile(found, "utf8");
}

async function findFile(dir, name) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { const sub = await findFile(full, name); if (sub) return sub; }
    else if (e.name === name) return full;
  }
  return null;
}

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
    entry.lastRun = { id: run.id, sha: run.head_sha.slice(0, 7), url: run.html_url, at: run.updated_at };
    if (!a.artifactPrefix) {
      const parsed = a.parse("");
      entry.ok = parsed.ok; entry.note = parsed.note; entry.summary = parsed.summary ?? null;
    } else {
      const raw = await fetchArtifact(run.id, a.artifactPrefix, a.keyFile);
      if (!raw) { entry.note = "artifact missing or empty"; }
      else {
        const parsed = a.parse(raw);
        entry.ok = parsed.ok; entry.summary = parsed.summary ?? parsed.rows ?? null; entry.note = parsed.note ?? null;
      }
    }
    const icon = entry.ok === true ? "✅" : entry.ok === false ? "❌" : entry.ok === null ? (a.optional ? "⚪" : "⚠️") : "—";
    const when = entry.lastRun?.at ?? "—";
    const detail = entry.note ?? (entry.summary ? "see artifact" : "—");
    md.push(`| [${a.name}](${entry.lastRun?.url ?? "#"}) | ${icon} | ${when} | ${detail} |`);
  } catch (err) {
    entry.note = "upstream error";
    md.push(`| ${a.name} | ⚠️ error | — | upstream error |`);
  }
  dashboard.audits[a.key] = entry;
}

md.push("");
md.push("> Reports retained 30-60 days per audit. Click an audit name above to open the run.");
md.push("> Live page: `/admin/audits` reads the latest `audits-dashboard-*` artifact via REST.");

const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const stripCtrl = (s) => String(s).replace(CTRL_RE, "");
const safeMd = md.map(stripCtrl).join("\n") + "\n";
await writeFile(safeWriteTarget(outDir, "dashboard.md"), safeMd);
await writeFile(safeWriteTarget(outDir, "dashboard.json"), stripCtrl(JSON.stringify(dashboard, null, 2)));
console.log(`\nDashboard → ${outDir}/dashboard.{json,md}`);

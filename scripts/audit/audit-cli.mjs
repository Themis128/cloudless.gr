#!/usr/bin/env node
/**
 * Unified audit CLI.
 *
 * Wraps the audit-reports workflow family in a single command-line
 * interface so the Cowork skill (.claude/skills/audit-reports/) and any
 * future MCP tooling can drive them uniformly.
 *
 * Commands:
 *   audit-cli list                     — list every audit workflow and its last run
 *   audit-cli run <key> [--strict]     — dispatch a workflow_dispatch run
 *   audit-cli watch <run-id>           — block until a run completes
 *   audit-cli download <run-id>        — fetch the audit-report artifact bundle to ./audit-report/
 *   audit-cli summary [--json]         — print the latest aggregator dashboard
 *
 *  Auth: GH_TOKEN (or `gh auth token`) with scopes `actions:read` + `actions:write`.
 */

import { spawnSync } from "node:child_process";

const REPO = process.env.AUDIT_REPO ?? "Themis128/cloudless.gr";
const AUDITS = {
  lighthouse: "lighthouse.yml",
  a11yLive: "a11y-live-audit.yml",
  securityHeaders: "security-headers-audit.yml",
  linkHealth: "link-health-audit.yml",
  depsDrift: "deps-drift-audit.yml",
  bundleBudget: "bundle-budget.yml",
  coreWebVitals: "core-web-vitals-audit.yml",
  clusterStatus: "cluster-status-audit.yml",
  aggregator: "audits-aggregator.yml",
};

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const r = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (r.status === 0) return r.stdout.trim();
  throw new Error("No GH_TOKEN; set env or run `gh auth login`.");
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      "User-Agent": "audit-cli/1.0",
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GH ${res.status} ${res.statusText}: ${path}\n${body.slice(0, 500)}`);
  }
  return res;
}

const [, , cmd, ...rest] = process.argv;

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`audit-cli <command>

  list                      list audits + last run status
  run <key> [--strict]      dispatch a workflow_dispatch run
  watch <run-id>            block until a run completes
  download <run-id>         fetch artifact bundle into ./audit-report/
  summary [--json]          print latest aggregator dashboard

  Keys: ${Object.keys(AUDITS).join(", ")}
`);
  process.exit(cmd ? 0 : 2);
}

if (cmd === "list") {
  const rows = [];
  for (const [key, wf] of Object.entries(AUDITS)) {
    const res = await gh(`/repos/${REPO}/actions/workflows/${encodeURIComponent(wf)}/runs?per_page=1`);
    const data = await res.json();
    const r = data.workflow_runs?.[0];
    rows.push({
      key,
      workflow: wf,
      lastRun: r ? `${r.id} ${r.conclusion ?? r.status} ${r.head_sha.slice(0, 7)} ${r.updated_at}` : "—",
    });
  }
  console.log("Audit                  Workflow                              Last run");
  console.log("─".repeat(110));
  for (const r of rows) {
    console.log(`${r.key.padEnd(22)} ${r.workflow.padEnd(37)} ${r.lastRun}`);
  }
} else if (cmd === "run") {
  const key = rest[0];
  const wf = AUDITS[key];
  if (!wf) {
    console.error(`Unknown audit key: ${key}. Try one of: ${Object.keys(AUDITS).join(", ")}`);
    process.exit(2);
  }
  const strict = rest.includes("--strict");
  const inputs = strict ? { strict: "true" } : {};
  await gh(`/repos/${REPO}/actions/workflows/${encodeURIComponent(wf)}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
  console.log(`Dispatched ${wf} (strict=${strict})`);
} else if (cmd === "watch") {
  const id = rest[0];
  for (;;) {
    const res = await gh(`/repos/${REPO}/actions/runs/${id}`);
    const r = await res.json();
    process.stdout.write(`\r${r.status} ${r.conclusion ?? ""}`.padEnd(60));
    if (r.status === "completed") {
      console.log(`\n${r.conclusion} → ${r.html_url}`);
      process.exit(r.conclusion === "success" ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
} else if (cmd === "download") {
  const id = rest[0];
  const res = await gh(`/repos/${REPO}/actions/runs/${id}/artifacts`);
  const data = await res.json();
  // CodeQL #1778 (js/http-to-file-access): bound the HTTP→disk flow with
  //   1) HTTPS-only + host allowlist  2) size cap  3) ZIP magic check.
  // 64 MiB cap matches aggregate.mjs — Lighthouse traces are ~22 MiB.
  const MAX_BYTES = 64 * 1024 * 1024;
  const ALLOWED_HOSTS = new Set([
    "api.github.com",
    "objects.githubusercontent.com",
    "pipelines.actions.githubusercontent.com",
  ]);
  const assertSafeUrl = (u) => {
    const p = new URL(u);
    if (p.protocol !== "https:") throw new Error(`non-HTTPS: ${p.protocol}`);
    const host = p.host.toLowerCase();
    const ok = ALLOWED_HOSTS.has(host) ||
      host.endsWith(".githubusercontent.com") ||
      host.endsWith(".blob.core.windows.net");
    if (!ok) throw new Error(`unallowed host: ${host}`);
  };
  const readBounded = async (response, maxBytes) => {
    const reader = response.body?.getReader?.();
    if (!reader) {
      const b = Buffer.from(await response.arrayBuffer());
      if (b.length > maxBytes) throw new Error(`response > ${maxBytes} bytes`);
      return b;
    }
    const chunks = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new Error(`response > ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  };
  for (const a of data.artifacts ?? []) {
    try {
      assertSafeUrl(a.archive_download_url);
    } catch (e) {
      console.warn(`skip ${a.name}: ${e.message}`);
      continue;
    }
    const zip = await fetch(a.archive_download_url, {
      headers: { Authorization: `Bearer ${token()}`, "User-Agent": "audit-cli/1.0" },
      redirect: "follow",
    });
    if (!zip.ok) {
      console.warn(`skip ${a.name}: HTTP ${zip.status}`);
      continue;
    }
    const ct = (zip.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("zip") && !ct.includes("octet-stream")) {
      console.warn(`skip ${a.name}: unexpected content-type ${ct}`);
      continue;
    }
    let buf;
    try {
      buf = await readBounded(zip, MAX_BYTES);
    } catch (e) {
      console.warn(`skip ${a.name}: ${e.message}`);
      continue;
    }
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      console.warn(`skip ${a.name}: not a ZIP (bad magic)`);
      continue;
    }
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { resolve: resolvePath, basename } = await import("node:path");
    await mkdir("audit-report", { recursive: true });
    const safeName = basename(String(a.name)).replace(/[\\/]/g, "");
    if (!safeName || safeName === "." || safeName === "..") {
      console.warn(`skip ${a.name}: unsafe artifact name`);
      continue;
    }
    const root = resolvePath("audit-report");
    const dest = resolvePath("audit-report", `${safeName}.zip`);
    if (!dest.startsWith(root + "/")) {
      console.warn(`skip ${a.name}: would write outside audit-report/`);
      continue;
    }
    await writeFile(dest, buf);
    console.log(`audit-report/${safeName}.zip (${buf.length} bytes)`);
  }
} else if (cmd === "summary") {
  const res = await gh(
    `/repos/${REPO}/actions/workflows/${encodeURIComponent(AUDITS.aggregator)}/runs?per_page=1&status=success`,
  );
  const data = await res.json();
  const run = data.workflow_runs?.[0];
  if (!run) {
    console.error("No successful aggregator run yet");
    process.exit(1);
  }
  console.log(`Aggregator run ${run.id} (${run.head_sha.slice(0, 7)}, ${run.updated_at}) → ${run.html_url}`);
  console.log(`Download the audits-dashboard-${run.id} artifact for the full report:`);
  console.log(`  audit-cli download ${run.id}`);
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(2);
}

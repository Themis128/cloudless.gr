#!/usr/bin/env node
/**
 * SonarQube Cloud doctor for Themis128/cloudless.gr (EU: sonarcloud.io).
 *
 * Requires SONAR_TOKEN (User token from sonarcloud.io → My Account → Security).
 * Never prints the token. Never reads .env.local.
 *
 * Usage:
 *   SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs
 *   SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --pr 1826
 *   SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --branch main
 *   SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --hotspots
 *   SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --ncloc
 */

const ORG = "Themis128";
const PROJECT = "Themis128_cloudless.gr";
const HOST = "https://sonarcloud.io";

function usage() {
  console.log(`Usage: node scripts/sonarcloud-doctor.mjs [--pr N | --branch NAME] [--hotspots] [--ncloc] [--issues]

Env:
  SONAR_TOKEN   SonarQube Cloud user token (required)

Examples:
  SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --branch main
  SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --pr 1826 --hotspots
`);
}

function parseArgs(argv) {
  const out = { pr: null, branch: "main", hotspots: false, ncloc: false, issues: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--pr") out.pr = argv[++i];
    else if (a === "--branch") out.branch = argv[++i];
    else if (a === "--hotspots") out.hotspots = true;
    else if (a === "--ncloc") out.ncloc = true;
    else if (a === "--issues") out.issues = true;
    else if (a === "--no-issues") out.issues = false;
  }
  return out;
}

async function api(token, path, params = {}) {
  const url = new URL(`${HOST}/api/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const msg = body?.errors?.[0]?.msg || body?.raw || res.statusText;
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return body;
}

function scopeParams(args) {
  if (args.pr) return { pullRequest: String(args.pr) };
  return { branch: args.branch || "main" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  const token = process.env.SONAR_TOKEN?.trim();
  if (!token) {
    console.error("ERR: set SONAR_TOKEN (sonarcloud.io → My Account → Security → Generate Tokens)");
    console.error("Unauthenticated API returns “Project doesn't exist” for private projects.");
    process.exit(2);
  }

  const scope = scopeParams(args);
  const label = args.pr ? `PR #${args.pr}` : `branch ${scope.branch}`;

  console.log(`SonarQube Cloud doctor — ${PROJECT} (${label})`);
  console.log(`Host: ${HOST}  Org: ${ORG}`);
  console.log("─".repeat(60));

  // Component / login check
  try {
    const show = await api(token, "components/show", { component: PROJECT });
    console.log(`✓ Project visible as ${show.component?.name || PROJECT}`);
  } catch (e) {
    console.error(`✗ Cannot see project: ${e.message}`);
    console.error("  Fix: log in on EU (sonarcloud.io), not US (sonarqube.us), as GitHub Themis128.");
    console.error("  Or regenerate SONAR_TOKEN for an account with access to org Themis128.");
    process.exit(1);
  }

  // Quality gate
  try {
    const qg = await api(token, "qualitygates/project_status", {
      projectKey: PROJECT,
      ...scope,
    });
    const status = qg.projectStatus?.status || "UNKNOWN";
    console.log(`\nQuality Gate: ${status}`);
    for (const c of qg.projectStatus?.conditions || []) {
      const failed = c.status === "ERROR";
      const mark = failed ? "✗" : "·";
      console.log(
        `  ${mark} ${c.metricKey}  actual=${c.actualValue ?? "—"}  ${c.comparator || ""}${c.errorThreshold ?? ""}  [${c.status}]`
      );
    }
  } catch (e) {
    console.error(`✗ Quality gate: ${e.message}`);
  }

  // Measures (ncloc)
  if (args.ncloc) {
    try {
      const m = await api(token, "measures/component", {
        component: PROJECT,
        metricKeys: "ncloc,duplicated_lines_density,reliability_rating,security_rating",
        ...scope,
      });
      console.log("\nMeasures:");
      for (const measure of m.component?.measures || []) {
        console.log(`  ${measure.metric}=${measure.value}`);
      }
    } catch (e) {
      console.error(`✗ Measures: ${e.message}`);
    }
  }

  // Issues (vulns / bugs / code smells on leak period)
  if (args.issues) {
    try {
      const issues = await api(token, "issues/search", {
        componentKeys: PROJECT,
        ...scope,
        sinceLeakPeriod: "true",
        resolved: "false",
        ps: 50,
        s: "SEVERITY",
        asc: "false",
      });
      console.log(`\nOpen issues on new code: ${issues.total}`);
      for (const issue of issues.issues || []) {
        const loc = issue.component?.split(":")?.pop() || issue.component;
        console.log(
          `  [${issue.type}/${issue.severity}] ${issue.rule}  ${loc}:${issue.line || "?"}  ${issue.message}`
        );
      }
    } catch (e) {
      console.error(`✗ Issues: ${e.message}`);
    }
  }

  // Hotspots
  if (args.hotspots) {
    try {
      const hs = await api(token, "hotspots/search", {
        projectKey: PROJECT,
        ...scope,
        status: "TO_REVIEW",
        ps: 50,
      });
      console.log(`\nSecurity hotspots TO_REVIEW: ${hs.paging?.total ?? hs.hotspots?.length ?? 0}`);
      for (const h of hs.hotspots || []) {
        const loc = h.component?.split(":")?.pop() || h.component;
        console.log(`  ${h.securityCategory}  ${loc}:${h.line || "?"}  ${h.message}`);
        console.log(`    key=${h.key}  → review in UI (cannot auto-fix from agent)`);
      }
    } catch (e) {
      console.error(`✗ Hotspots: ${e.message}`);
    }
  }

  console.log("\n─".repeat(30));
  console.log("Next:");
  console.log("  • S2245 Math.random → globalThis.crypto.getRandomValues / randomUUID");
  console.log("  • Hotspots → human Reviewed in Sonar UI (or fix pattern)");
  console.log("  • LOC Free ~50k → see .sonarcloud.properties sonar.sources");
  console.log("  • Skill: .claude/skills/sonarcloud-operator/SKILL.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

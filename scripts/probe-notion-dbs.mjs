#!/usr/bin/env node
/**
 * Probe all 13 configured Notion databases and report which are reachable
 * by the "Cloudless.gr App" integration. Run this:
 *   • After re-sharing a database with the integration to verify the fix.
 *   • As a pre-flight before relying on a Notion-backed feature in production.
 *   • From CI to catch silent permission drift.
 *
 * Why this exists: per docs/notion-integration-reshare.md, several DBs
 * (case-studies, testimonials, services, FAQs) periodically lose their
 * integration share and return `object_not_found`. The app falls back to
 * static content, so the symptom is invisible until someone notices the
 * blog/case-studies index is stale. This script is the canonical way to
 * audit "what does Notion currently let us read."
 *
 * Reads Notion database IDs and API key from D1 app_config via /api/config
 * endpoint (Cloudflare-first) with env var fallback.
 * No placeholders, no fabricated IDs — if a config is missing, that DB
 * row reports "not configured".
 *
 * Exit codes:
 *   0  every configured DB returned 200
 *   1  one or more configured DBs returned 404 (re-share action required)
 *   2  Notion API key missing or auth failed
 *   3  Config fetch error
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CONFIG_URL = process.env.CONFIG_URL || "http://localhost:8787/api/config";

const DB_KEYS = [
  ["NOTION_BLOG_DB_ID", "Blog posts"],
  ["NOTION_DOCS_DB_ID", "Docs pages"],
  ["NOTION_PROJECTS_DB_ID", "Projects"],
  ["NOTION_TASKS_DB_ID", "Tasks"],
  ["NOTION_CALENDAR_DB_ID", "Content calendar (Postiz)"],
  ["NOTION_SUBMISSIONS_DB_ID", "Contact form submissions"],
  ["NOTION_TESTIMONIALS_DB_ID", "Testimonials"],
  ["NOTION_CASE_STUDIES_DB_ID", "Case studies"],
  ["NOTION_SERVICES_DB_ID", "Services"],
  ["NOTION_FAQS_DB_ID", "FAQs"],
];

// Map config keys to D1 app_config keys
const CONFIG_KEY_MAP = {
  "NOTION_BLOG_DB_ID": "notion_blog_db_id",
  "NOTION_DOCS_DB_ID": "notion_docs_db_id",
  "NOTION_PROJECTS_DB_ID": "notion_projects_db_id",
  "NOTION_TASKS_DB_ID": "notion_tasks_db_id",
  "NOTION_CALENDAR_DB_ID": "notion_calendar_db_id",
  "NOTION_SUBMISSIONS_DB_ID": "notion_submissions_db_id",
  "NOTION_TESTIMONIALS_DB_ID": "notion_testimonials_db_id",
  "NOTION_CASE_STUDIES_DB_ID": "notion_case_studies_db_id",
  "NOTION_SERVICES_DB_ID": "notion_services_db_id",
  "NOTION_FAQS_DB_ID": "notion_faqs_db_id",
  "NOTION_API_KEY": "notion_api_key",
};

async function loadConfig() {
  const config = {};
  
  // Try to fetch from D1 config endpoint
  for (const [envKey, configKey] of Object.entries(CONFIG_KEY_MAP)) {
    try {
      const res = await fetch(`${CONFIG_URL}?key=${encodeURIComponent(configKey)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.value) {
          config[envKey] = json.value;
        }
      }
    } catch (err) {
      // Ignore fetch errors, fall back to env vars
    }
    
    // Fallback to environment variable
    if (!config[envKey] && process.env[envKey]) {
      config[envKey] = process.env[envKey];
    }
  }
  
  return config;
}

async function probeDb(id, apiKey) {
  // Notion's data-source-aware "databases" replacement is /data_sources/{id},
  // but for the legacy DB IDs the app stores, GET /databases/{id} still
  // returns 200 on success and 404 with object_not_found on permission loss.
  const res = await fetch(`${NOTION_API}/databases/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  if (res.status === 200) {
    const body = await res.json();
    const title = body.title?.[0]?.plain_text ?? "(untitled)";
    return { ok: true, status: 200, title };
  }
  if (res.status === 401) return { ok: false, status: 401, code: "unauthorized" };
  const body = await res.json().catch(() => ({}));
  return { ok: false, status: res.status, code: body.code ?? "unknown", message: body.message };
}

function pad(s, n) {
  return String(s).padEnd(n);
}

async function main() {
  let config;
  try {
    config = await loadConfig();
  } catch (err) {
    console.error(`Config fetch failed: ${err.message}`);
    process.exit(3);
  }

  const apiKey = config.NOTION_API_KEY;
  if (!apiKey) {
    console.error(
      "NOTION_API_KEY missing from both D1 config (notion_api_key) and env."
    );
    process.exit(2);
  }

  console.log("Probing Notion databases via 'Cloudless.gr App' integration...\n");
  console.log(pad("DB", 30), pad("STATUS", 10), pad("CODE", 20), "TITLE / NOTES");
  console.log("-".repeat(120));

  let failures = 0;
  let unconfigured = 0;
  const failed = [];

  for (const [key, label] of DB_KEYS) {
    const id = config[key];
    if (!id) {
      unconfigured++;
      console.log(pad(label, 30), pad("⚪ skip", 10), pad("not configured", 20), key);
      continue;
    }
    const result = await probeDb(id, apiKey);
    if (result.ok) {
      console.log(pad(label, 30), pad("✅ 200", 10), pad("", 20), result.title);
    } else {
      failures++;
      failed.push({ key, label });
      console.log(
        pad(label, 30),
        pad(`❌ ${result.status}`, 10),
        pad(result.code, 20),
        result.message ?? ""
      );
    }
  }

  console.log("-".repeat(120));
  console.log(
    `\n${DB_KEYS.length - unconfigured - failures} OK · ${failures} failed · ${unconfigured} not configured`
  );

  if (failures > 0) {
    console.log("\nTo fix the failed databases:");
    console.log("  1. Open https://www.notion.so/ as a Workspace Owner.");
    console.log("  2. For each failed DB below, open it (browse by name).");
    console.log("  3. Click ⋯ (top-right) → Connections → Add connections.");
    console.log("  4. Pick 'Cloudless.gr App'.");
    console.log("  5. Re-run: node scripts/probe-notion-dbs.mjs");
    console.log("\nFailed DBs:");
    for (const f of failed) console.log(`  • ${f.label}  (${f.key})`);
    console.log("\nFull runbook: docs/notion-integration-reshare.md");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
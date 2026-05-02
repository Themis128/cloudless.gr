#!/usr/bin/env npx tsx
/**
 * Notion Connection Test & Content Viewer
 *
 * Usage:
 *   npx tsx scripts/notion-test.ts            # test all databases
 *   npx tsx scripts/notion-test.ts blog       # test blog only
 *   npx tsx scripts/notion-test.ts docs       # test docs only
 *   npx tsx scripts/notion-test.ts projects   # test projects only
 *   npx tsx scripts/notion-test.ts tasks      # test tasks only
 *   npx tsx scripts/notion-test.ts analytics  # test analytics only
 *   npx tsx scripts/notion-test.ts submissions # test submissions only
 *
 * Requires: NOTION_API_KEY + database IDs in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const KEY = process.env.NOTION_API_KEY;

// ── Helpers ──────────────────────────────────────────────────

function headers() {
  return {
    Authorization: `Bearer ${KEY}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

function extractText(richText: any[] | undefined): string {
  if (!richText?.length) return "";
  return richText.map((t: any) => t.plain_text ?? "").join("");
}

function extractSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

function extractMultiSelect(prop: any): string[] {
  return (prop?.multi_select ?? []).map((s: any) => s.name);
}

function extractDate(prop: any): string {
  return prop?.date?.start ?? "";
}

function extractCheckbox(prop: any): boolean {
  return prop?.checkbox ?? false;
}

function extractNumber(prop: any): number | null {
  return prop?.number ?? null;
}

function extractTitle(prop: any): string {
  return extractText(prop?.title);
}

const OK = "\x1b[32m[OK]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
const WARN = "\x1b[33m[WARN]\x1b[0m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function heading(text: string) {
  console.log(`\n${BOLD}${CYAN}━━━ ${text} ━━━${RESET}`);
}

function row(label: string, value: string | number | boolean | null) {
  const v = value === null || value === undefined || value === "" ? `${DIM}(empty)${RESET}` : String(value);
  console.log(`  ${label}: ${v}`);
}

// ── API calls ────────────────────────────────────────────────

async function testAuth(): Promise<boolean> {
  heading("Authentication");
  if (!KEY || KEY === "PASTE_YOUR_NOTION_API_KEY_HERE") {
    console.log(`  ${FAIL} NOTION_API_KEY not set β€" edit .env.local first`);
    return false;
  }
  console.log(`  API Key: ${KEY.slice(0, 8)}...${KEY.slice(-4)}`);

  try {
    const res = await fetch(`${API}/users/me`, { headers: headers() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.log(`  ${FAIL} Auth failed (${res.status}): ${body.message ?? "unknown"}`);
      return false;
    }
    const me = await res.json();
    console.log(`  ${OK} Authenticated as: ${me.name ?? me.bot?.owner?.user?.name ?? "bot"}`);
    console.log(`  Type: ${me.type}`);
    return true;
  } catch (err: any) {
    console.log(`  ${FAIL} Connection error: ${err.message}`);
    return false;
  }
}

async function queryDatabase(
  name: string,
  dbId: string | undefined,
  mapFn: (page: any) => Record<string, any>,
  limit = 5,
): Promise<boolean> {
  heading(name);

  if (!dbId) {
    console.log(`  ${WARN} Database ID not set β€" skipped`);
    return false;
  }
  console.log(`  DB ID: ${dbId}`);

  try {
    const res = await fetch(`${API}/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ page_size: limit }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.log(`  ${FAIL} Query failed (${res.status}): ${body.message ?? "unknown"}`);
      if (res.status === 404) {
        console.log(`  ${DIM}  β†' Make sure you shared this database with your integration${RESET}`);
      }
      return false;
    }

    const data = await res.json();
    const total = data.results?.length ?? 0;
    const hasMore = data.has_more;
    console.log(`  ${OK} Connected β€" ${total} rows returned${hasMore ? " (more available)" : ""}`);

    if (total === 0) {
      console.log(`  ${DIM}  (database is empty)${RESET}`);
      return true;
    }

    console.log("");
    for (let i = 0; i < Math.min(total, limit); i++) {
      const page = data.results[i];
      const mapped = mapFn(page);
      console.log(`  ${BOLD}#${i + 1}${RESET}`);
      for (const [k, v] of Object.entries(mapped)) {
        row(`    ${k}`, v);
      }
      if (i < Math.min(total, limit) - 1) console.log("");
    }

    return true;
  } catch (err: any) {
    console.log(`  ${FAIL} Error: ${err.message}`);
    return false;
  }
}

// ── Database mappers ─────────────────────────────────────────

function mapBlogPost(page: any) {
  const p = page.properties;
  return {
    Title: extractTitle(p.Title ?? p.Name),
    Slug: extractText(p.Slug?.rich_text),
    Category: extractSelect(p.Category),
    Tags: extractMultiSelect(p.Tags).join(", "),
    Author: extractText(p.Author?.rich_text),
    Date: extractDate(p.Date),
    Published: extractCheckbox(p.Published),
    Featured: extractCheckbox(p.Featured),
    Excerpt: extractText(p.Excerpt?.rich_text)?.slice(0, 80) + "...",
  };
}

function mapDoc(page: any) {
  const p = page.properties;
  return {
    Title: extractTitle(p.Title ?? p.Name),
    Slug: extractText(p.Slug?.rich_text),
    Category: extractSelect(p.Category),
    Published: extractCheckbox(p.Published),
    "Verification Status": extractSelect(p["Verification Status"]),
    Owner: extractText(p.Owner?.rich_text),
    Order: extractNumber(p.Order),
  };
}

function mapProject(page: any) {
  const p = page.properties;
  return {
    Name: extractTitle(p.Name),
    Status: extractSelect(p.Status),
    Priority: extractSelect(p.Priority),
    Type: extractSelect(p.Type),
    Owner: extractText(p.Owner?.rich_text),
    Progress: extractNumber(p.Progress) !== null ? `${extractNumber(p.Progress)}%` : null,
    "Start Date": extractDate(p["Start Date"]),
    "Due Date": extractDate(p["Due Date"]),
  };
}

function mapTask(page: any) {
  const p = page.properties;
  return {
    Task: extractTitle(p.Task ?? p.Name),
    Status: extractSelect(p.Status),
    Priority: extractSelect(p.Priority),
    Assignee: extractText(p.Assignee?.rich_text),
    Project: p.Project?.relation?.map((r: { id: string }) => r.id).join(", ") ?? "",
    "Due Date": extractDate(p["Due Date"]),
    Type: extractSelect(p.Type),
    Estimate: extractSelect(p.Estimate),
    Sprint: extractText(p.Sprint?.rich_text),
  };
}

function mapSubmission(page: any) {
  const p = page.properties;
  return {
    Name: extractTitle(p.Name),
    Email: extractText(p.Email?.rich_text ?? p.Email?.email ? [{ plain_text: p.Email.email }] : []),
    Company: extractText(p.Company?.rich_text),
    Service: extractSelect(p.Service),
    Status: extractSelect(p.Status),
    "Submitted At": extractDate(p["Submitted At"]),
  };
}

function mapAnalytics(page: any) {
  const p = page.properties;
  return {
    Event: extractTitle(p.Event ?? p.Name),
    Type: extractSelect(p.Type),
    Page: extractText(p.Page?.rich_text),
    Source: extractText(p.Source?.rich_text),
    Count: extractNumber(p.Count),
    Date: extractDate(p.Date),
  };
}

// ── Main ─────────────────────────────────────────────────────

const DB_MAP: Record<string, { envKey: string; mapper: (p: any) => Record<string, any> }> = {
  blog: { envKey: "NOTION_BLOG_DB_ID", mapper: mapBlogPost },
  docs: { envKey: "NOTION_DOCS_DB_ID", mapper: mapDoc },
  projects: { envKey: "NOTION_PROJECTS_DB_ID", mapper: mapProject },
  tasks: { envKey: "NOTION_TASKS_DB_ID", mapper: mapTask },
  submissions: { envKey: "NOTION_SUBMISSIONS_DB_ID", mapper: mapSubmission },
  analytics: { envKey: "NOTION_ANALYTICS_DB_ID", mapper: mapAnalytics },
};

async function main() {
  console.log(`${BOLD}${CYAN}`);
  console.log("+--------------------------------------+");
  console.log("|  Notion Integration - Connection Test |");
  console.log("+--------------------------------------+");
  console.log(`${RESET}`);

  const authed = await testAuth();
  if (!authed) {
    console.log(`\n${FAIL} Cannot continue without authentication.`);
    console.log(`\nSteps to fix:`);
    console.log(`  1. Go to ${CYAN}https://www.notion.so/my-integrations${RESET}`);
    console.log(`  2. Create an Internal Integration`);
    console.log(`  3. Copy the secret and paste it in .env.local as NOTION_API_KEY`);
    console.log(`  4. Share each database with the integration (DB β†' … β†' Connections)`);
    process.exit(1);
  }

  const filter = process.argv[2]?.toLowerCase();
  const targets = filter ? [filter] : Object.keys(DB_MAP);
  let passed = 0;
  let failed = 0;

  for (const name of targets) {
    const entry = DB_MAP[name];
    if (!entry) {
      console.log(`\n${WARN} Unknown database: "${name}". Options: ${Object.keys(DB_MAP).join(", ")}`);
      continue;
    }
    const ok = await queryDatabase(
      `${name.charAt(0).toUpperCase() + name.slice(1)} Database`,
      process.env[entry.envKey],
      entry.mapper,
    );
    if (ok) passed++;
    else failed++;
  }

  // Summary
  heading("Summary");
  console.log(`  ${OK} Passed: ${passed}`);
  if (failed > 0) console.log(`  ${FAIL} Failed: ${failed}`);
  console.log("");

  if (failed > 0) process.exit(1);
}

main();

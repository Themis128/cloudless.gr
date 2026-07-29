#!/usr/bin/env node
/**
 * Backfill AppFlowy CMS page bodies from Notion properties.
 *
 * The initial migrate created titled pages but failed to upload content
 * (`POST /doc/:id` → 404). This script appends markdown property blocks via
 * `POST .../page-view/:id/append-block` for CMS-prefixed pages only.
 *
 * Usage:
 *   node scripts/backfill-appflowy-cms-bodies.mjs [--dry-run] [--force]
 *
 * Env: NOTION_API_KEY, APPFLOWY_API_URL, APPFLOWY_EMAIL, APPFLOWY_PASSWORD
 */

import {
  appendMarkdownBlocks,
  extractTextFromEncodedCollab,
} from "./lib/appflowy-page-content.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const CMS_DB_MATCHERS = [
  { match: /^(blog posts|blog)$/i, prefix: "[Blog]" },
  { match: /^(internal docs|knowledge base|docs)$/i, prefix: "[Docs]" },
  { match: /^services$/i, prefix: "[Service]" },
  { match: /^faqs$/i, prefix: "[FAQ]" },
  { match: /^testimonials$/i, prefix: "[Testimonial]" },
  { match: /^case studies$/i, prefix: "[CaseStudy]" },
];

const BODY_MARKERS = [
  "**Answer**:",
  "**Slug**:",
  "**Description**:",
  "**Quote**:",
  "**Company**:",
  "**Summary**:",
  "**Challenge**:",
];

async function notionPost(path, token, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Notion POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getAppFlowyToken(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/gotrue/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`AppFlowy login failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("AppFlowy login: no access_token");
  return data.access_token;
}

async function appflowyGet(path, token, baseUrl) {
  const res = await fetch(`${baseUrl}/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AppFlowy GET ${path} → ${res.status}`);
  return res.json();
}

function richTextToString(rt) {
  if (!Array.isArray(rt)) return "";
  return rt.map((t) => t.plain_text ?? "").join("");
}

function propertyToString(key, prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return `**${key}**: ${richTextToString(prop.title)}`;
    case "rich_text":
      return `**${key}**: ${richTextToString(prop.rich_text)}`;
    case "number":
      return `**${key}**: ${prop.number ?? ""}`;
    case "select":
      return `**${key}**: ${prop.select?.name ?? ""}`;
    case "multi_select":
      return `**${key}**: ${(prop.multi_select ?? []).map((s) => s.name).join(", ")}`;
    case "date":
      return `**${key}**: ${prop.date?.start ?? ""}${prop.date?.end ? ` → ${prop.date.end}` : ""}`;
    case "checkbox":
      return `**${key}**: ${prop.checkbox ? "✅" : "☐"}`;
    case "url":
      return `**${key}**: ${prop.url ?? ""}`;
    case "email":
      return `**${key}**: ${prop.email ?? ""}`;
    case "phone_number":
      return `**${key}**: ${prop.phone_number ?? ""}`;
    case "status":
      return `**${key}**: ${prop.status?.name ?? ""}`;
    case "people":
      return `**${key}**: ${(prop.people ?? []).map((p) => p.name ?? p.id).join(", ")}`;
    default:
      return "";
  }
}

function pageToMarkdown(page) {
  const lines = [];
  for (const [key, prop] of Object.entries(page.properties ?? {})) {
    const line = propertyToString(key, prop);
    if (line) lines.push(line);
  }
  lines.push(`\n_Notion page ID: ${page.id}_`);
  lines.push(`_Created: ${page.created_time}_`);
  if (page.url) lines.push(`_Source: ${page.url}_`);
  return lines.join("\n\n");
}

function extractTitle(page) {
  for (const prop of Object.values(page.properties ?? {})) {
    if (prop.type === "title") return richTextToString(prop.title) || "Untitled";
  }
  return "Untitled";
}

function titledForAppFlowy(dbTitle, pageTitle) {
  const rule = CMS_DB_MATCHERS.find((r) => r.match.test(dbTitle.trim()));
  if (!rule) return null;
  if (pageTitle.startsWith(rule.prefix)) return pageTitle;
  return `${rule.prefix} ${pageTitle}`;
}

async function queryDatabaseAll(dbId, notionToken) {
  const rows = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionPost(`/databases/${dbId}/query`, notionToken, body);
    rows.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor && rows.length < 1000);
  return rows;
}

function flattenFolder(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const child of node) flattenFolder(child, out);
    return out;
  }
  if (typeof node !== "object") return out;
  const view = node.view ?? node;
  if (view.view_id && view.name) {
    out.push({ view_id: view.view_id, name: view.name });
  }
  if (Array.isArray(view.children)) flattenFolder(view.children, out);
  if (node !== view && Array.isArray(node.children)) flattenFolder(node.children, out);
  return out;
}

function hasCmsBody(text) {
  const lower = text.toLowerCase();
  return BODY_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

async function pageHasBody(baseUrl, token, workspaceId, viewId) {
  const res = await appflowyGet(
    `/workspace/${workspaceId}/page-view/${viewId}`,
    token,
    baseUrl
  );
  const encoded = res?.data?.data?.encoded_collab;
  return hasCmsBody(extractTextFromEncodedCollab(encoded));
}

async function main() {
  const notionToken = process.env.NOTION_API_KEY;
  const baseUrl = (process.env.APPFLOWY_API_URL ?? "").replace(/\/$/, "");
  const email = process.env.APPFLOWY_EMAIL ?? "";
  const password = process.env.APPFLOWY_PASSWORD ?? "";

  if (!notionToken) {
    console.error("NOTION_API_KEY not set");
    process.exit(1);
  }
  if (!baseUrl || !email || !password) {
    console.error("APPFLOWY_API_URL, APPFLOWY_EMAIL, and APPFLOWY_PASSWORD required");
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}${FORCE ? " (force)" : ""}`);

  const token = await getAppFlowyToken(baseUrl, email, password);
  const wsData = await appflowyGet("/workspace", token, baseUrl);
  const workspaceId = wsData.data?.[0]?.workspace_id;
  if (!workspaceId) {
    console.error("No AppFlowy workspace found");
    process.exit(1);
  }

  const folder = await appflowyGet(`/workspace/${workspaceId}/folder?depth=10`, token, baseUrl);
  const views = flattenFolder(folder.data);
  const byName = new Map();
  for (const v of views) {
    if (!byName.has(v.name)) byName.set(v.name, v.view_id);
  }
  console.log(`AppFlowy views indexed: ${byName.size}`);

  let searchCursor;
  const databases = [];
  do {
    const body = { filter: { value: "database", property: "object" }, page_size: 100 };
    if (searchCursor) body.start_cursor = searchCursor;
    const data = await notionPost("/search", notionToken, body);
    databases.push(...(data.results ?? []));
    searchCursor = data.has_more ? data.next_cursor : undefined;
  } while (searchCursor);

  const cmsDbs = databases.filter((db) =>
    CMS_DB_MATCHERS.some((r) => r.match.test(richTextToString(db.title) || ""))
  );
  console.log(`CMS Notion databases: ${cmsDbs.length}`);

  const summary = [];

  for (const db of cmsDbs) {
    const dbTitle = richTextToString(db.title) || db.id;
    console.log(`\n── ${dbTitle}`);
    const rows = await queryDatabaseAll(db.id, notionToken);
    let filled = 0;
    let skipped = 0;
    let missing = 0;
    let failed = 0;

    for (const page of rows) {
      const title = titledForAppFlowy(dbTitle, extractTitle(page));
      if (!title) continue;
      const viewId = byName.get(title);
      if (!viewId) {
        missing++;
        console.warn(`  missing AppFlowy page: ${title}`);
        continue;
      }

      const markdown = pageToMarkdown(page);
      if (!FORCE) {
        try {
          if (await pageHasBody(baseUrl, token, workspaceId, viewId)) {
            skipped++;
            continue;
          }
        } catch (err) {
          console.warn(`  body-check failed for ${title}: ${err.message}`);
        }
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] would append ${markdown.split("\n").length} lines → ${title}`);
        filled++;
        continue;
      }

      try {
        await appendMarkdownBlocks({
          baseUrl,
          token,
          workspaceId,
          viewId,
          markdown,
        });
        filled++;
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        failed++;
        console.error(`  append failed for ${title}: ${err.message}`);
      }
    }

    summary.push({ db: dbTitle, filled, skipped, missing, failed, total: rows.length });
    console.log(
      `  filled=${filled} skipped=${skipped} missing=${missing} failed=${failed} total=${rows.length}`
    );
  }

  console.log("\n── Backfill summary ──");
  for (const s of summary) {
    console.log(
      `  ${s.db}: filled ${s.filled}/${s.total} (skipped ${s.skipped}, missing ${s.missing}, failed ${s.failed})`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

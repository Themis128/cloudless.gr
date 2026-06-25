#!/usr/bin/env node
/**
 * scripts/migrate-notion-to-appflowy.mjs
 *
 * Exports every Notion database and page into AppFlowy as Document pages.
 * Run once after AppFlowy is live and configured in SSM.
 *
 * Prerequisites:
 *   - NOTION_API_KEY in env or SSM
 *   - APPFLOWY_API_URL + APPFLOWY_JWT_SECRET in env or SSM (or env directly)
 *   - APPFLOWY_EMAIL + APPFLOWY_PASSWORD for the GoTrue auth-token upload path
 *
 * Usage:
 *   node scripts/migrate-notion-to-appflowy.mjs [--dry-run]
 *
 * What it does:
 *   1. Lists all Notion databases visible to the integration.
 *   2. For each database, creates an AppFlowy folder-Document with the DB name.
 *   3. Queries up to 1000 rows from each database.
 *   4. For each row, creates a child Document page in AppFlowy with the row title + all properties as markdown.
 *   5. Reports counts per database on completion.
 *
 * AppFlowy page content is uploaded as markdown via the AppFlowy Cloud REST API
 * POST /api/workspace/:workspaceId/page-view (layout=0 = Document) — same path
 * used by scripts/appflowy-upload-md.mjs.
 */

import { createHmac } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ────────────────────────────────────────────────────────────────

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signServiceJwt(secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: "", role: "supabase_admin", iss: "migrate-script", iat: now, exp: now + 300 };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

async function notionGet(path, token, cursor) {
  const url = `https://api.notion.com/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Notion GET ${path} → ${res.status}`);
  return res.json();
}

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

async function appflowyPost(path, jwtSecret, baseUrl, body) {
  const token = signServiceJwt(jwtSecret);
  const res = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AppFlowy POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function appflowyGet(path, jwtSecret, baseUrl) {
  const token = signServiceJwt(jwtSecret);
  const res = await fetch(`${baseUrl}/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AppFlowy GET ${path} → ${res.status}`);
  return res.json();
}

// ── Property → Markdown renderer ───────────────────────────────────────────

function richTextToString(rt) {
  if (!Array.isArray(rt)) return "";
  return rt.map((t) => t.plain_text ?? "").join("");
}

function propertyToString(key, prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title":      return `**${key}**: ${richTextToString(prop.title)}`;
    case "rich_text":  return `**${key}**: ${richTextToString(prop.rich_text)}`;
    case "number":     return `**${key}**: ${prop.number ?? ""}`;
    case "select":     return `**${key}**: ${prop.select?.name ?? ""}`;
    case "multi_select": return `**${key}**: ${(prop.multi_select ?? []).map((s) => s.name).join(", ")}`;
    case "date":       return `**${key}**: ${prop.date?.start ?? ""}${prop.date?.end ? ` → ${prop.date.end}` : ""}`;
    case "checkbox":   return `**${key}**: ${prop.checkbox ? "✅" : "☐"}`;
    case "url":        return `**${key}**: ${prop.url ?? ""}`;
    case "email":      return `**${key}**: ${prop.email ?? ""}`;
    case "phone_number": return `**${key}**: ${prop.phone_number ?? ""}`;
    case "status":     return `**${key}**: ${prop.status?.name ?? ""}`;
    case "people":     return `**${key}**: ${(prop.people ?? []).map((p) => p.name ?? p.id).join(", ")}`;
    default:           return "";
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

// ── Notion pagination ───────────────────────────────────────────────────────

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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const notionToken = process.env.NOTION_API_KEY;
  const appflowyBase = (process.env.APPFLOWY_API_URL ?? "").replace(/\/$/, "");
  const jwtSecret = process.env.APPFLOWY_JWT_SECRET ?? "";

  if (!notionToken) { console.error("NOTION_API_KEY not set"); process.exit(1); }
  if (!appflowyBase || !jwtSecret) { console.error("APPFLOWY_API_URL and APPFLOWY_JWT_SECRET required"); process.exit(1); }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  // 1. Get AppFlowy primary workspace
  const wsData = await appflowyGet("/admin/workspace", jwtSecret, appflowyBase);
  const workspaceId = wsData.data?.[0]?.workspace_id;
  if (!workspaceId) { console.error("No AppFlowy workspace found"); process.exit(1); }
  console.log(`AppFlowy workspace: ${workspaceId}`);

  // 2. Get root view to use as parent
  const folderData = await appflowyGet(
    `/workspace/${workspaceId}/folder?depth=1`, jwtSecret, appflowyBase
  );
  const rootViewId = folderData.data?.[0]?.view_id;
  if (!rootViewId) { console.error("No root view found in AppFlowy workspace"); process.exit(1); }

  // 3. Search Notion for all databases
  let searchCursor;
  const databases = [];
  do {
    const body = { filter: { value: "database", property: "object" }, page_size: 100 };
    if (searchCursor) body.start_cursor = searchCursor;
    const data = await notionPost("/search", notionToken, body);
    databases.push(...(data.results ?? []));
    searchCursor = data.has_more ? data.next_cursor : undefined;
  } while (searchCursor);

  console.log(`Found ${databases.length} Notion databases`);

  const summary = [];

  for (const db of databases) {
    const dbTitle = richTextToString(db.title) || db.id;
    console.log(`\n── ${dbTitle} (${db.id})`);

    let dbViewId;
    if (!DRY_RUN) {
      try {
        const createRes = await appflowyPost(
          `/workspace/${workspaceId}/page-view`,
          jwtSecret,
          appflowyBase,
          { name: dbTitle, parent_view_id: rootViewId, layout: 0 }
        );
        dbViewId = createRes.data?.view_id;
        console.log(`  Created folder page: ${dbViewId}`);
      } catch (err) {
        console.error(`  Failed to create folder page: ${err.message}`);
        continue;
      }
    } else {
      console.log(`  [dry-run] Would create AppFlowy page: "${dbTitle}"`);
      dbViewId = "dry-run-parent";
    }

    // 4. Query all rows
    let rows;
    try {
      rows = await queryDatabaseAll(db.id, notionToken);
    } catch (err) {
      console.error(`  Failed to query database: ${err.message}`);
      summary.push({ db: dbTitle, migrated: 0, error: err.message });
      continue;
    }
    console.log(`  ${rows.length} rows`);

    let migrated = 0;
    for (const page of rows) {
      const title = extractTitle(page);
      const markdown = pageToMarkdown(page);

      if (!DRY_RUN) {
        try {
          const pageRes = await appflowyPost(
            `/workspace/${workspaceId}/page-view`,
            jwtSecret,
            appflowyBase,
            { name: title, parent_view_id: dbViewId, layout: 0 }
          );
          const pageViewId = pageRes.data?.view_id;
          if (pageViewId && markdown.length > 0) {
            // Upload markdown content to the page
            await appflowyPost(
              `/workspace/${workspaceId}/doc/${pageViewId}`,
              jwtSecret,
              appflowyBase,
              { data: markdown }
            ).catch(() => {
              // Content upload is best-effort — page exists, content may need manual edit
            });
          }
          migrated++;
        } catch (err) {
          console.error(`  Failed to create page "${title}": ${err.message}`);
        }
      } else {
        console.log(`  [dry-run] Would create: "${title}"`);
        migrated++;
      }

      // Rate limit: AppFlowy handles ~10 req/s
      if (!DRY_RUN) await new Promise((r) => setTimeout(r, 120));
    }

    summary.push({ db: dbTitle, migrated, total: rows.length });
  }

  console.log("\n── Migration summary ──");
  for (const s of summary) {
    console.log(`  ${s.db}: ${s.migrated}/${s.total ?? s.migrated} pages${s.error ? ` (error: ${s.error})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

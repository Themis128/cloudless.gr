#!/usr/bin/env npx tsx
/**
 * Notion schema sync — idempotent property additions for cloudless workspace DBs.
 *
 * Bypasses the Notion MCP's silent no-op on schema-edit by calling the Notion
 * REST API directly with the workspace integration token (NOTION_API_KEY).
 *
 * Usage:
 *   export NOTION_API_KEY=...                         # or via .env.local
 *   npx tsx scripts/notion-schema-sync.ts             # apply
 *   npx tsx scripts/notion-schema-sync.ts --dry-run   # report only, no writes
 *
 * Adds (idempotent — re-running is safe):
 *   Blog Posts:                Locale, Updated At, Status
 *   Contact Form Submissions:  Locale, Replied At, Notes, HubSpot Contact ID
 *   Site Analytics:            Locale
 *   Content Calendar:          Locale, Target Blog Post (relation → Blog Posts)
 *   Tasks:                     Related Blog Post (relation → Blog Posts)
 *   Internal Docs:             Stale After
 *
 * Existing properties are never modified or removed. Schema additions are safe
 * for the running cloudless.gr Lambda (existing reads ignore unknown props).
 */

const BLOG_POSTS_DB_ID = "0ac591657ee44063bbbc8004ea7ccd6c";

import { config } from "dotenv";
config({ path: ".env.local" });

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const KEY = process.env.NOTION_API_KEY;
const DRY = process.argv.includes("--dry-run");

if (!KEY) {
  console.error("missing NOTION_API_KEY (set in env or .env.local)");
  process.exit(1);
}

type PropSchema = Record<string, unknown>;

const LOCALE_OPTIONS = [
  { name: "en", color: "blue" },
  { name: "el", color: "green" },
  { name: "fr", color: "purple" },
];

const PLAN: { db: string; id: string; props: Record<string, PropSchema> }[] = [
  {
    db: "Blog Posts",
    id: BLOG_POSTS_DB_ID,
    props: {
      Locale: { select: { options: LOCALE_OPTIONS } },
      "Updated At": { last_edited_time: {} },
      Status: {
        select: {
          options: [
            { name: "Draft", color: "gray" },
            { name: "In Review", color: "yellow" },
            { name: "Published", color: "green" },
            { name: "Archived", color: "red" },
          ],
        },
      },
    },
  },
  {
    db: "Contact Form Submissions",
    id: "9abe0a5614d64b759d44a45cee2d0bbc",
    props: {
      Locale: { select: { options: LOCALE_OPTIONS } },
      "Replied At": { date: {} },
      Notes: { rich_text: {} },
      "HubSpot Contact ID": { rich_text: {} },
    },
  },
  {
    db: "Site Analytics",
    id: "cc4287fcb42a42dc92a7053d6f1199c7",
    props: {
      Locale: { select: { options: LOCALE_OPTIONS } },
    },
  },
  {
    db: "Content Calendar",
    id: "dcff73b9317b4ed69a450f200db0f629",
    props: {
      Locale: { select: { options: LOCALE_OPTIONS } },
      "Target Blog Post": { relation: { database_id: BLOG_POSTS_DB_ID, single_property: {} } },
    },
  },
  {
    db: "Tasks",
    id: "14ce4ff6c400437597b13e70ac909354",
    props: {
      "Related Blog Post": { relation: { database_id: BLOG_POSTS_DB_ID, single_property: {} } },
    },
  },
  {
    db: "Internal Docs",
    id: "b45af6ed5bb64d89b9a92a8aff4a9b29",
    props: {
      "Stale After": { date: {} },
    },
  },
];

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function fetchExistingProps(dbId: string): Promise<Set<string>> {
  const r = await fetch(`${API}/databases/${dbId}`, { headers: headers() });
  if (!r.ok) {
    throw new Error(`GET database ${dbId} → ${r.status} ${await r.text()}`);
  }
  const json = await r.json();
  return new Set(Object.keys(json.properties ?? {}));
}

async function patchSchema(
  dbId: string,
  toAdd: Record<string, PropSchema>,
): Promise<void> {
  const body = JSON.stringify({ properties: toAdd });
  const r = await fetch(`${API}/databases/${dbId}`, {
    method: "PATCH",
    headers: headers(),
    body,
  });
  if (!r.ok) {
    throw new Error(`PATCH database ${dbId} → ${r.status} ${await r.text()}`);
  }
}

async function syncOne(plan: (typeof PLAN)[number]): Promise<void> {
  const existing = await fetchExistingProps(plan.id);
  const missing = Object.entries(plan.props).filter(([n]) => !existing.has(n));
  if (missing.length === 0) {
    console.log(`✔ ${plan.db}: schema already in sync`);
    return;
  }
  console.log(
    `→ ${plan.db}: add ${missing.length} prop(s): ${missing.map(([n]) => n).join(", ")}`,
  );
  if (DRY) return;
  const toAdd = Object.fromEntries(missing);
  await patchSchema(plan.id, toAdd);
  console.log(`✔ ${plan.db}: applied`);
}

async function main(): Promise<void> {
  console.log(`notion-schema-sync ${DRY ? "[DRY-RUN]" : "[APPLY]"}`);
  for (const plan of PLAN) {
    try {
      await syncOne(plan);
    } catch (e) {
      console.error(`✘ ${plan.db}:`, e instanceof Error ? e.message : e);
      process.exit(2);
    }
  }
  console.log("done");
}

main();

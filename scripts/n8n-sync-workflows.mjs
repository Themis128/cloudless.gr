#!/usr/bin/env node
/**
 * Sync workflow JSON files from infrastructure/n8n/workflows/ into the
 * live n8n instance via its REST API.
 *
 * Match strategy: workflow name (exact string, case-sensitive).
 *   - Exists in n8n  →  PUT (update nodes/connections/settings).
 *                        Active state is preserved — does not flip running workflows.
 *   - Not found      →  POST (create). Activates if JSON has active:true.
 *
 * Required env vars:
 *   N8N_API_URL   e.g. http://100.74.191.58:30900
 *   N8N_API_KEY   n8n API key (Settings → n8n API → Create an API key)
 */

import { readFileSync, readdirSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = join(__dir, "..", "infrastructure", "n8n", "workflows");

const BASE = (process.env.N8N_API_URL ?? "").replace(/\/$/, "");
const KEY = process.env.N8N_API_KEY;

if (!BASE || !KEY) {
  console.error("N8N_API_URL and N8N_API_KEY are required");
  process.exit(1);
}

async function n8nFetch(method, path, body) {
  const opts = {
    method,
    headers: {
      "X-N8N-API-KEY": KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api/v1${path}`, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function listAllWorkflows() {
  const data = await n8nFetch("GET", "/workflows?limit=250&active=false");
  const active = await n8nFetch("GET", "/workflows?limit=250&active=true");
  return [...(data?.data ?? []), ...(active?.data ?? [])];
}

function nameFromFilename(file) {
  return basename(file, ".json")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const files = readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  console.log(`\n📂  ${files.length} workflow file(s) in infrastructure/n8n/workflows/\n`);

  const existing = await listAllWorkflows();
  const byName = new Map(existing.map((w) => [w.name, w]));
  console.log(`🔗  n8n has ${existing.length} existing workflow(s)\n`);

  let created = 0,
    updated = 0,
    errors = 0;

  for (const file of files) {
    const filePath = join(WORKFLOWS_DIR, file);
    let wf;
    try {
      wf = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error(`  ✗ ${file}: JSON parse error — ${e.message}`);
      errors++;
      continue;
    }

    // Derive name from filename when the JSON has no name field
    if (!wf.name || typeof wf.name !== "string" || !wf.name.trim()) {
      wf.name = nameFromFilename(file);
    }

    const name = wf.name;
    const shouldBeActive = wf.active === true;

    // Strip the file-level id — n8n manages its own ids
    const { id: _fileId, ...wfBody } = wf;

    const live = byName.get(name);

    try {
      if (live) {
        // Update: PUT preserves active state (only structural changes)
        await n8nFetch("PUT", `/workflows/${live.id}`, {
          ...wfBody,
          active: live.active, // keep whatever n8n says
          id: String(live.id),
        });
        console.log(`  ↺  Updated  : ${name}`);
        updated++;
      } else {
        // Create, then activate if JSON requests it
        const created_wf = await n8nFetch("POST", "/workflows", { ...wfBody, active: false });
        if (shouldBeActive) {
          await n8nFetch("POST", `/workflows/${created_wf.id}/activate`);
          console.log(`  +  Created  : ${name}  → activated`);
        } else {
          console.log(`  +  Created  : ${name}  (inactive)`);
        }
        created++;
      }
    } catch (e) {
      console.error(`  ✗  Error    : ${name} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\n✅  Done — created: ${created}  updated: ${updated}  errors: ${errors}\n`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

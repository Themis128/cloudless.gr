#!/usr/bin/env node
/**
 * seed-appflowy-cms-folders.mjs
 *
 * Creates the top-level CMS folder pages the admin AppFlowy status probe
 * expects (Blog, Docs, Projects, …) in a fresh workspace.
 *
 * Fresh AppFlowy workspaces 404 on GET /folder until the first page exists.
 * Creating these pages at the workspace root initializes the folder tree.
 *
 * Env:
 *   APPFLOWY_API_URL or APPFLOWY_BASE_URL
 *   APPFLOWY_EMAIL
 *   APPFLOWY_PASSWORD
 *
 * Usage:
 *   node scripts/seed-appflowy-cms-folders.mjs [--dry-run]
 */
import { randomUUID } from "node:crypto";
import { createPageWithContent } from "./lib/appflowy-page-content.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const CMS_FOLDERS = [
  "Blog",
  "Docs",
  "Projects",
  "Tasks",
  "Submissions",
  "Analytics",
  "Case Studies",
  "FAQs",
  "Services",
  "Testimonials",
];

const baseUrl = (
  process.env.APPFLOWY_API_URL ||
  process.env.APPFLOWY_BASE_URL ||
  "https://appflowy.cloudless.gr"
).replace(/\/$/, "");
const email = process.env.APPFLOWY_EMAIL;
const password = process.env.APPFLOWY_PASSWORD;

if (!email || !password) {
  console.error("error: APPFLOWY_EMAIL and APPFLOWY_PASSWORD are required");
  process.exit(2);
}

async function login() {
  const res = await fetch(`${baseUrl}/gotrue/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GoTrue login failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.access_token) throw new Error("GoTrue response missing access_token");
  return body.access_token;
}

async function listWorkspaces(token) {
  const res = await fetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`list workspaces failed: HTTP ${res.status}`);
  const body = await res.json();
  return body.data || [];
}

function walkFolder(node, visit) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walkFolder(child, visit);
    return;
  }
  if (typeof node !== "object") return;
  const view = node.view || node;
  visit(view);
  if (Array.isArray(view.children)) walkFolder(view.children, visit);
  if (node !== view && Array.isArray(node.children)) walkFolder(node.children, visit);
}

async function loadFolder(token, workspaceId) {
  const res = await fetch(`${baseUrl}/api/workspace/${workspaceId}/folder?depth=5`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`folder list failed: HTTP ${res.status}`);
  const body = await res.json();
  return body.data ?? null;
}

async function listFolderNames(token, workspaceId) {
  const root = await loadFolder(token, workspaceId);
  const names = new Set();
  walkFolder(root, (view) => {
    if (view?.name) names.add(String(view.name));
  });
  return names;
}

/** Prefer the default "General" space; fall back to workspace root. */
async function resolveParentViewId(token, workspaceId) {
  const root = await loadFolder(token, workspaceId);
  let generalId = null;
  walkFolder(root, (view) => {
    if (generalId) return;
    if (view?.is_space && String(view.name || "").toLowerCase() === "general" && view.view_id) {
      generalId = view.view_id;
    }
  });
  return generalId || workspaceId;
}

async function main() {
  console.log(`login ${email} @ ${baseUrl}`);
  const token = await login();
  const workspaces = await listWorkspaces(token);
  if (!workspaces.length) throw new Error("no workspaces");
  const workspaceId = workspaces[0].workspace_id;
  console.log(`workspace ${workspaceId} (${workspaces[0].workspace_name})`);

  const parentViewId = await resolveParentViewId(token, workspaceId);
  console.log(`parent_view ${parentViewId}`);

  const existing = await listFolderNames(token, workspaceId);
  console.log(`existing views: ${existing.size}`);

  let created = 0;
  let skipped = 0;
  for (const name of CMS_FOLDERS) {
    if ([...existing].some((n) => n.toLowerCase() === name.toLowerCase())) {
      console.log(`skip ${name} (exists)`);
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`dry-run would create ${name}`);
      created += 1;
      continue;
    }
    const { viewId } = await createPageWithContent({
      baseUrl,
      token,
      workspaceId,
      parentViewId,
      title: name,
      markdown: `# ${name}\n\nCMS folder seeded for cloudless.gr admin.\n`,
      viewId: randomUUID(),
    });
    console.log(`created ${name} → ${viewId}`);
    created += 1;
  }

  console.log(`done created=${created} skipped=${skipped} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

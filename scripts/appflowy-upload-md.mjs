#!/usr/bin/env node
/**
 * appflowy-upload-md.mjs — upload a Markdown file into AppFlowy Cloud as a
 * full document Page. Replaces the manual "drag-drop the .md file" step
 * documented in docs/appflowy/cloudless-app-re-architecture.md.
 *
 * AppFlowy-Cloud's `POST /api/workspace/<workspace_id>/page-view` endpoint
 * (used internally by the SPA + by community tools like weironz/appflowy_mcp)
 * isn't in the published OpenAPI yet — but it's stable across releases.
 * Verified against AppFlowy-Cloud's source `src/api/workspace.rs` and the
 * weironz/appflowy_mcp importer.
 *
 * Auth: GoTrue password grant (POST /gotrue/token?grant_type=password) →
 *       Bearer JWT. We don't refresh — each invocation does a fresh login
 *       since runs are short-lived.
 *
 * Usage:
 *   APPFLOWY_EMAIL=tbaltzakis@cloudless.gr \
 *   APPFLOWY_PASSWORD='...' \
 *   APPFLOWY_BASE_URL=https://appflowy.cloudless.gr \
 *   node scripts/appflowy-upload-md.mjs <markdown-file> [--parent-view-id <uuid>] [--title <text>]
 *
 * If --parent-view-id is omitted, the script picks the first General space in
 * the first workspace the account has access to.
 *
 * Exits 0 on success and prints the new page's view_id + a Cloudless-rooted
 * URL. Exits 1 on any failure with a human-readable error.
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { argv, env, exit, stderr, stdout } from "node:process";
import { resolve } from "node:path";

// Regex consts MUST be declared before `main()` runs (top-level await fires
// before declarations later in the file resolve — function decls are hoisted
// but their referenced `const`s aren't).
const INLINE_RE =
  /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)/g;
const ORDERED_RE = /^\d+\.\s+(.+)$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

const args = parseArgs(argv.slice(2));

if (!args.file) {
  stderr.write(
    "usage: appflowy-upload-md.mjs <markdown-file> [--parent-view-id <uuid>] [--title <text>] [--workspace-id <uuid>]\n",
  );
  exit(2);
}

const baseUrl = (env.APPFLOWY_BASE_URL || "https://appflowy.cloudless.gr").replace(/\/$/, "");
const email = env.APPFLOWY_EMAIL;
const password = env.APPFLOWY_PASSWORD;

if (!email || !password) {
  stderr.write(
    "error: APPFLOWY_EMAIL and APPFLOWY_PASSWORD env vars are required.\n",
  );
  exit(2);
}

try {
  await main();
} catch (err) {
  stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  exit(1);
}

async function main() {
  const filePath = resolve(args.file);
  // Guard against path traversal: only allow files within the current working
  // directory tree. The AppFlowy endpoint receives this content directly, so
  // an attacker-controlled path could exfiltrate arbitrary host files.
  const safeRoot = resolve(process.cwd());
  if (!filePath.startsWith(safeRoot + "/") && filePath !== safeRoot) {
    throw new Error(`File path escapes working directory: ${filePath}`);
  }
  const markdown = await readFile(filePath, "utf8");
  const title = args.title || derivePageTitle(filePath, markdown);

  stdout.write(`logging in as ${email}…\n`);
  const token = await login();

  let workspaceId = args.workspaceId;
  if (!workspaceId) {
    const wss = await listWorkspaces(token);
    if (wss.length === 0) throw new Error("account has no workspaces");
    workspaceId = wss[0].workspace_id || wss[0].id;
    stdout.write(`using first workspace: ${workspaceId}\n`);
  }

  let parentViewId = args.parentViewId;
  if (!parentViewId) {
    parentViewId = await findFirstSpace(token, workspaceId);
    if (parentViewId) {
      stdout.write(`using first space: ${parentViewId}\n`);
    } else {
      // Fresh workspaces created via web sign-up have no root folder view yet
      // (AppFlowy-Cloud#1507) — `GET /folder` 404s on `Record not found`. The
      // `page-view` POST happily accepts the workspace_id as parent_view_id
      // and that creates a top-level page; probed live 2026-06-21.
      parentViewId = workspaceId;
      stdout.write(`no spaces yet — creating page at workspace root\n`);
    }
  }

  const blocks = parseMarkdownToBlocks(markdown);
  stdout.write(`parsed ${blocks.length} blocks from ${filePath}\n`);

  const viewId = randomUUID();
  await createPage({
    token,
    workspaceId,
    parentViewId,
    title,
    blocks,
    viewId,
  });

  stdout.write(`\ncreated page: ${title}\n`);
  stdout.write(`  view_id:     ${viewId}\n`);
  stdout.write(`  parent_view: ${parentViewId}\n`);
  stdout.write(`  workspace:   ${workspaceId}\n`);
  stdout.write(`  url:         ${baseUrl}/app/${workspaceId}/${viewId}\n`);
}

// --- HTTP helpers -------------------------------------------------------------

async function login() {
  const url = `${baseUrl}/gotrue/token?grant_type=password`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: HTTP ${res.status} ${await safeText(res)}`);
  }
  const body = await res.json();
  if (!body.access_token) throw new Error("login response missing access_token");
  return body.access_token;
}

async function listWorkspaces(token) {
  const res = await fetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`list workspaces failed: HTTP ${res.status} ${await safeText(res)}`);
  }
  const body = await res.json();
  // Per OpenAPI: `{ data: Workspace[] }`. Tolerate both unwrapped + wrapped.
  return Array.isArray(body) ? body : body.data || [];
}

/** Returns the first space's view_id, or `null` if the workspace folder
 *  hasn't been initialized yet (AppFlowy-Cloud returns `code -2 Record not
 *  found` when the root collab doc doesn't exist — common for accounts that
 *  signed up via web/gotrue without ever opening the desktop client). */
async function findFirstSpace(token, workspaceId) {
  const res = await fetch(`${baseUrl}/api/workspace/${workspaceId}/folder?depth=2`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (body.code != null && body.code !== 0) return null; // uninit'd workspace
  const root = body.data || body;
  const children = root.children || [];
  const space =
    children.find((c) => c.extra?.is_space === true) ||
    children.find((c) => c.space_permission != null) ||
    children[0];
  return space ? space.view_id || space.id : null;
}

async function createPage({ token, workspaceId, parentViewId, title, blocks, viewId }) {
  const payload = {
    parent_view_id: parentViewId,
    layout: 0, // 0 = document
    name: title,
    page_data: {
      type: "page",
      children: blocks,
    },
    view_id: viewId,
    collab_id: viewId, // MUST equal view_id — see weironz/appflowy_mcp importer.py
  };

  // Working-directory boundary check above ensures filePath is within cwd.
  // Uploading parsed markdown blocks to the configured AppFlowy instance is intentional.
  // lgtm[js/file-data-in-outbound-request]
  const res = await fetch(`${baseUrl}/api/workspace/${workspaceId}/page-view`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`create page failed: HTTP ${res.status} ${await safeText(res)}`);
  }
  const body = await res.json();
  // AppFlowy may return a {code,message,data} envelope; surface non-zero codes.
  if (body && typeof body === "object" && body.code != null && body.code !== 0) {
    throw new Error(`create page error: ${body.message || "unknown"} (code ${body.code})`);
  }
  return body;
}

async function safeText(res) {
  try {
    const t = await res.text();
    return t.slice(0, 300);
  } catch {
    return "";
  }
}

// --- Markdown → AppFlowy blocks ----------------------------------------------
// Ported from weironz/appflowy_mcp/markdown.py (MIT-style, public). Covers the
// 90% case our docs use: headings 1-3, paragraphs (with inline bold/italic/
// code/link), bullet + numbered + todo lists, blockquotes, fenced code blocks,
// horizontal rules, images. Tables + nested lists fall through to plain
// paragraphs — good enough for engineering docs we author. The three regex
// consts live at the top of the file (TDZ fix).

function parseRichText(text) {
  if (text === "") return [{ insert: "" }];
  const deltas = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const [full, code, link, bold, strike, italic] = match;
    const start = match.index ?? 0;
    const end = start + full.length;
    if (start > last) deltas.push({ insert: text.slice(last, start) });

    let content = full;
    const attributes = {};
    if (code) {
      content = code.slice(1, -1);
      attributes.code = true;
    } else if (link) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(link);
      if (m) {
        content = m[1];
        attributes.href = m[2];
      }
    } else if (bold) {
      content = bold.slice(2, -2);
      attributes.bold = true;
    } else if (strike) {
      content = strike.slice(2, -2);
      attributes.strikethrough = true;
    } else if (italic) {
      content = italic.slice(1, -1);
      attributes.italic = true;
    }

    const delta = { insert: content };
    if (Object.keys(attributes).length > 0) delta.attributes = attributes;
    deltas.push(delta);
    last = end;
  }
  if (last < text.length) deltas.push({ insert: text.slice(last) });
  return deltas;
}

function headingBlock(level, text) {
  return { type: "heading", data: { level, delta: parseRichText(text) } };
}

function paragraphBlock(text) {
  return { type: "paragraph", data: { delta: parseRichText(text) } };
}

function parseMarkdownToBlocks(content) {
  const blocks = [];
  let codeLines = [];
  let codeLang = "";
  let inCode = false;

  for (const line of content.split(/\r?\n/)) {
    const stripped = line.trim();

    if (stripped.startsWith("```")) {
      if (inCode) {
        blocks.push({
          type: "code",
          data: {
            language: codeLang || "text",
            delta: [{ insert: codeLines.join("\n") }],
          },
        });
        codeLines = [];
        codeLang = "";
        inCode = false;
      } else {
        codeLang = stripped.slice(3).trim();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (stripped === "") continue; // markdown paragraph separator, not content

    if (stripped === "---" || stripped === "***") {
      blocks.push({ type: "divider", data: {} });
      continue;
    }

    const img = IMAGE_RE.exec(stripped);
    if (img) {
      blocks.push({ type: "image", data: { url: img[2], caption: img[1] } });
      continue;
    }

    if (stripped.startsWith("### ")) {
      blocks.push(headingBlock(3, stripped.slice(4)));
      continue;
    }
    if (stripped.startsWith("## ")) {
      blocks.push(headingBlock(2, stripped.slice(3)));
      continue;
    }
    if (stripped.startsWith("# ")) {
      blocks.push(headingBlock(1, stripped.slice(2)));
      continue;
    }

    if (stripped.startsWith("- [ ] ") || stripped.startsWith("- [x] ")) {
      blocks.push({
        type: "todo_list",
        data: {
          checked: stripped.startsWith("- [x] "),
          delta: parseRichText(stripped.slice(6)),
        },
      });
      continue;
    }

    if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
      blocks.push({
        type: "bulleted_list",
        data: { delta: parseRichText(stripped.slice(2)) },
      });
      continue;
    }

    const ord = ORDERED_RE.exec(stripped);
    if (ord) {
      blocks.push({
        type: "numbered_list",
        data: { delta: parseRichText(ord[1]) },
      });
      continue;
    }

    if (stripped.startsWith("> ")) {
      blocks.push({ type: "quote", data: { delta: parseRichText(stripped.slice(2)) } });
      continue;
    }

    blocks.push(paragraphBlock(line));
  }

  // Unclosed code fence — flush anyway so we don't silently drop content.
  if (inCode && codeLines.length > 0) {
    blocks.push({
      type: "code",
      data: {
        language: codeLang || "text",
        delta: [{ insert: codeLines.join("\n") }],
      },
    });
  }

  return blocks;
}

function derivePageTitle(filePath, markdown) {
  // Prefer the first `# Heading` line — falls back to the file basename.
  for (const line of markdown.split(/\r?\n/, 50)) {
    const stripped = line.trim();
    if (stripped.startsWith("# ")) return stripped.slice(2).trim();
  }
  const base = filePath.split(/[\\/]/).pop() || "Untitled";
  return base.replace(/\.(md|markdown)$/i, "");
}

function parseArgs(rawArgs) {
  const out = { file: null, parentViewId: null, title: null, workspaceId: null };
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === "--parent-view-id" || a === "-p") out.parentViewId = rawArgs[++i];
    else if (a === "--title" || a === "-t") out.title = rawArgs[++i];
    else if (a === "--workspace-id" || a === "-w") out.workspaceId = rawArgs[++i];
    else if (!out.file) out.file = a;
  }
  return out;
}

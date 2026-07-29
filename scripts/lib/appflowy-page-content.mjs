/**
 * Shared AppFlowy page content helpers.
 *
 * Content must be written via `page_data` on create or
 * `POST .../page-view/:id/append-block` — `/doc/:id` is 404 on our build.
 *
 * Markdown → blocks ported from scripts/appflowy-upload-md.mjs
 * (weironz/appflowy_mcp markdown.py lineage).
 */

import { randomUUID } from "node:crypto";

const INLINE_RE =
  /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)/g;
const ORDERED_RE = /^\d+\.\s+(.+)$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

export function parseRichText(text) {
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

export function parseMarkdownToBlocks(content) {
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

    if (stripped === "") continue;

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

export async function createPageWithContent({
  baseUrl,
  token,
  workspaceId,
  parentViewId,
  title,
  markdown,
  viewId = randomUUID(),
}) {
  const blocks = parseMarkdownToBlocks(markdown);
  const payload = {
    parent_view_id: parentViewId,
    layout: 0,
    name: title,
    page_data: {
      type: "page",
      children: blocks,
    },
    view_id: viewId,
    collab_id: viewId,
  };

  const res = await fetch(`${baseUrl}/api/workspace/${workspaceId}/page-view`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`create page failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (body?.code != null && body.code !== 0) {
    throw new Error(`create page error: ${body.message || "unknown"} (code ${body.code})`);
  }
  return { viewId: body?.data?.view_id || viewId, body };
}

export async function appendMarkdownBlocks({
  baseUrl,
  token,
  workspaceId,
  viewId,
  markdown,
}) {
  const blocks = parseMarkdownToBlocks(markdown);
  if (blocks.length === 0) return { skipped: true, reason: "empty-markdown" };

  const res = await fetch(
    `${baseUrl}/api/workspace/${workspaceId}/page-view/${viewId}/append-block`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ blocks }),
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!res.ok) {
    throw new Error(`append-block failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (body?.code != null && body.code !== 0) {
    throw new Error(`append-block error: ${body.message || "unknown"} (code ${body.code})`);
  }
  return { skipped: false, blockCount: blocks.length, body };
}

/** Best-effort plain text from page-view encoded_collab (mirrors src/lib/appflowy.ts). */
const CMS_FIELD_KEYS = [
  "StripePriceId",
  "Description",
  "CoverImage",
  "Challenge",
  "Solution",
  "Results",
  "Category",
  "Features",
  "Industry",
  "Summary",
  "Company",
  "Service",
  "Featured",
  "Published",
  "Locale",
  "Answer",
  "Client",
  "Rating",
  "Quote",
  "Price",
  "Order",
  "Slug",
  "Icon",
  "Name",
  "Role",
  "Tags",
  "Date",
  "CTA",
];

export function extractTextFromEncodedCollab(encoded) {
  if (!encoded) return "";
  const blob = Array.isArray(encoded)
    ? Buffer.from(encoded)
    : Buffer.from(String(encoded), "utf8");
  const latin = blob.toString("latin1");
  const fields = [];
  for (const key of CMS_FIELD_KEYS) {
    const keyRe = new RegExp(`(?:^|[^A-Za-z])${key}(?![A-Za-z])`, "g");
    let match;
    while ((match = keyRe.exec(latin)) !== null) {
      const window = latin.slice(match.index + match[0].length, match.index + match[0].length + 900);
      const valueMatch = /:\s*([^']{1,800})'/.exec(window);
      if (valueMatch?.[1]) {
        const value = Buffer.from(valueMatch[1], "latin1")
          .toString("utf8")
          .replace(/[\u0000-\u001f\u007f-\u009f]+/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (value) {
          fields.push(`**${key}**: ${value}`);
          break;
        }
      }
    }
  }
  if (fields.length > 0) return Array.from(new Set(fields)).join("\n");
  const matches = latin.match(/[\x20-\x7e]{4,}/g) ?? [];
  return matches
    .map((s) => s.replace(/'+$/g, "").trim())
    .filter((s) => /^\*\*[A-Za-z][^*]+\*\*:/.test(s) || (s.includes(" ") && s.length >= 24))
    .join("\n");
}

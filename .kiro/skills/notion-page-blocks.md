---
inclusion: manual
---

# Notion Page & Block Management

This skill covers reading, creating, updating, and deleting page content (blocks) via the Notion REST API, plus patterns for rendering Notion content to HTML/Markdown.

## Page Endpoints

### Create a Page

**POST** `/v1/pages`

A page can live under a database (as a record) or under another page (as a child page).

```json
{
  "parent": { "page_id": "<parent-page-uuid>" },
  "properties": {
    "title": [{ "text": { "content": "My Page Title" } }]
  },
  "children": [
    {
      "object": "block",
      "type": "heading_2",
      "heading_2": { "rich_text": [{ "text": { "content": "Introduction" } }] }
    },
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": { "rich_text": [{ "text": { "content": "Welcome to this page." } }] }
    }
  ]
}
```

You can include up to 100 blocks in `children` on creation. For more, append after creation.

### Retrieve a Page

**GET** `/v1/pages/{page_id}`

Returns the page object with properties but NOT content blocks. To get content, query blocks.

### Update Page Properties

**PATCH** `/v1/pages/{page_id}`

### Get Page as Markdown (API v2025+)

**GET** `/v1/pages/{page_id}/markdown`

Returns the full page content as markdown. A newer, simpler alternative to walking blocks.

### Update Page via Markdown (API v2025+)

**PATCH** `/v1/pages/{page_id}/markdown` with `{ "markdown": "# New content\n\nParagraph here." }`

---

## Block Endpoints

### List Block Children (Read Page Content)

**GET** `/v1/blocks/{block_id}/children?page_size=100`

Returns a paginated list of child blocks. A page IS a block, so use the page ID as `block_id`.

Pagination: follow `next_cursor` while `has_more` is true.

For nested blocks (toggles, lists with children), you must recursively fetch children of each block that has `has_children: true`.

### Append Block Children (Add Content)

**PATCH** `/v1/blocks/{block_id}/children`

```json
{
  "children": [
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [{ "text": { "content": "New paragraph added." } }]
      }
    }
  ]
}
```

Use `after` parameter to insert after a specific block: `?after=<block-id>`.

### Update a Block

**PATCH** `/v1/blocks/{block_id}`

Send the block type with updated content:

```json
{
  "paragraph": {
    "rich_text": [{ "text": { "content": "Updated text." } }]
  }
}
```

### Delete a Block

**DELETE** `/v1/blocks/{block_id}`

---

## Block Types Reference

Read `references/block-types.md` for the complete list with JSON shapes for every block type.

### Most Common Block Types

**Text blocks** (all support `rich_text` array + `color` + optional `children`):
`paragraph`, `heading_1`, `heading_2`, `heading_3`, `bulleted_list_item`, `numbered_list_item`, `to_do`, `toggle`, `quote`, `callout`

**Media blocks** (use `external.url` or `file.url`):
`image`, `video`, `file`, `pdf`, `audio`

**Structural blocks**:
`divider`, `table_of_contents`, `breadcrumb`, `column_list`, `column`, `table`, `table_row`

**Embed blocks**:
`embed`, `bookmark`, `link_preview`, `equation`

**Container blocks**:
`child_page`, `child_database`, `synced_block`, `template`, `toggle`

---

## Rich Text Format

Every text-containing block uses an array of rich text objects:

```json
[
  {
    "type": "text",
    "text": { "content": "Hello ", "link": null },
    "annotations": {
      "bold": false, "italic": false, "strikethrough": false,
      "underline": false, "code": false, "color": "default"
    }
  },
  {
    "type": "text",
    "text": { "content": "world", "link": null },
    "annotations": { "bold": true, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" }
  }
]
```

**Rich text types**: `text`, `mention`, `equation`

**Mention sub-types**: `user`, `page`, `database`, `date`, `link_preview`

**Color values**: `default`, `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red` — plus `*_background` variants (e.g., `blue_background`)

### Extracting Plain Text

```typescript
const plainText = richTextArray.map(rt => rt.plain_text).join("");
```

---

## Rendering Blocks to HTML

A proven pattern for converting Notion blocks to safe HTML:

```typescript
function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = [];
  let listBuffer: string[] = [];
  let listType = "";

  function flushList() {
    if (listBuffer.length === 0) return;
    const tag = listType === "bulleted_list_item" ? "ul" : "ol";
    parts.push(`<${tag}>${listBuffer.join("")}</${tag}>`);
    listBuffer = [];
    listType = "";
  }

  for (const block of blocks) {
    const isList = block.type === "bulleted_list_item" || block.type === "numbered_list_item";
    if (!isList) flushList();

    switch (block.type) {
      case "paragraph":
        parts.push(`<p>${richTextToHtml(block.paragraph.rich_text)}</p>`);
        break;
      case "heading_1":
        parts.push(`<h1>${richTextToHtml(block.heading_1.rich_text)}</h1>`);
        break;
      case "heading_2":
        parts.push(`<h2>${richTextToHtml(block.heading_2.rich_text)}</h2>`);
        break;
      case "heading_3":
        parts.push(`<h3>${richTextToHtml(block.heading_3.rich_text)}</h3>`);
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
        if (listType && listType !== block.type) flushList();
        listType = block.type;
        const content = block[block.type];
        listBuffer.push(`<li>${richTextToHtml(content.rich_text)}</li>`);
        break;
      case "code":
        const lang = block.code.language || "";
        parts.push(`<pre><code class="language-${lang}">${escapeHtml(
          block.code.rich_text.map(t => t.plain_text).join("")
        )}</code></pre>`);
        break;
      case "quote":
        parts.push(`<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`);
        break;
      case "callout":
        const icon = block.callout.icon?.emoji || "💡";
        parts.push(`<div class="callout">${icon} ${richTextToHtml(block.callout.rich_text)}</div>`);
        break;
      case "divider":
        parts.push("<hr/>");
        break;
      case "image":
        const imgUrl = block.image.type === "external"
          ? block.image.external.url : block.image.file.url;
        parts.push(`<img src="${imgUrl}" alt="" loading="lazy"/>`);
        break;
      case "to_do":
        const checked = block.to_do.checked ? "checked" : "";
        parts.push(`<div class="todo"><input type="checkbox" ${checked} disabled/> ${richTextToHtml(block.to_do.rich_text)}</div>`);
        break;
      case "toggle":
        parts.push(`<details><summary>${richTextToHtml(block.toggle.rich_text)}</summary></details>`);
        break;
      case "bookmark":
        parts.push(`<a href="${block.bookmark.url}" target="_blank">${block.bookmark.url}</a>`);
        break;
      case "embed":
        parts.push(`<iframe src="${block.embed.url}" loading="lazy"></iframe>`);
        break;
      case "video":
        const vidUrl = block.video.type === "external"
          ? block.video.external.url : block.video.file.url;
        parts.push(`<video src="${vidUrl}" controls></video>`);
        break;
      // Unsupported blocks are silently skipped
    }
  }
  flushList();
  return parts.join("\n");
}
```

### Rich Text to HTML

```typescript
function richTextToHtml(richText: RichTextItem[]): string {
  return richText.map(rt => {
    let html = escapeHtml(rt.plain_text);
    const a = rt.annotations;
    if (a.bold) html = `<strong>${html}</strong>`;
    if (a.italic) html = `<em>${html}</em>`;
    if (a.strikethrough) html = `<del>${html}</del>`;
    if (a.underline) html = `<u>${html}</u>`;
    if (a.code) html = `<code>${html}</code>`;
    if (a.color !== "default") html = `<span style="color:${a.color}">${html}</span>`;
    if (rt.text?.link) html = `<a href="${rt.text.link.url}">${html}</a>`;
    return html;
  }).join("");
}
```

---

## Recursive Block Tree Fetching

Some blocks have nested children. To get the full content tree:

```typescript
async function fetchAllBlocks(blockId: string): Promise<Block[]> {
  const blocks = await listAllChildren(blockId);
  for (const block of blocks) {
    if (block.has_children) {
      block.children = await fetchAllBlocks(block.id);
    }
  }
  return blocks;
}
```

---

## Building a CMS with Notion

A common pattern for blogs/docs powered by Notion:

1. **Database as content list** — query with `Published: true` filter, sort by date
2. **Page blocks as content body** — fetch all blocks for a page, convert to HTML
3. **ISR for caching** — use Next.js `revalidate` (e.g., 300s) or on-demand revalidation via webhooks
4. **Fallback pattern** — check `isConfigured()` and fall back to static content when Notion isn't connected
5. **Cover images** — available at `page.cover.external.url` or `page.cover.file.url`
6. **SEO metadata** — store in database properties (seo_title, seo_description, slug)

## Reference Files

→ `references/block-types.md` — Complete JSON shapes for every block type


## Reference: block-types.md

# Notion Block Types — Complete JSON Reference

## Text Blocks

### Paragraph

```json
{ "type": "paragraph", "paragraph": { "rich_text": [], "color": "default", "children": [] } }
```

### Headings

```json
{ "type": "heading_1", "heading_1": { "rich_text": [], "color": "default", "is_toggleable": false } }
{ "type": "heading_2", "heading_2": { "rich_text": [], "color": "default", "is_toggleable": false } }
{ "type": "heading_3", "heading_3": { "rich_text": [], "color": "default", "is_toggleable": false } }
```

When `is_toggleable: true`, the heading acts as a toggle — it can have children.

### Callout

```json
{ "type": "callout", "callout": { "rich_text": [], "icon": { "emoji": "💡" }, "color": "default" } }
```

Icon can be `{ "emoji": "..." }` or `{ "external": { "url": "..." } }`.

### Quote

```json
{ "type": "quote", "quote": { "rich_text": [], "color": "default", "children": [] } }
```

## List Blocks

### Bulleted List Item

```json
{ "type": "bulleted_list_item", "bulleted_list_item": { "rich_text": [], "color": "default", "children": [] } }
```

### Numbered List Item

```json
{ "type": "numbered_list_item", "numbered_list_item": { "rich_text": [], "color": "default", "children": [] } }
```

### To Do

```json
{ "type": "to_do", "to_do": { "rich_text": [], "checked": false, "color": "default", "children": [] } }
```

### Toggle

```json
{ "type": "toggle", "toggle": { "rich_text": [], "color": "default", "children": [] } }
```

## Code Block

```json
{ "type": "code", "code": { "rich_text": [], "caption": [], "language": "javascript" } }
```

Languages: `abap`, `arduino`, `bash`, `basic`, `c`, `clojure`, `coffeescript`, `cpp`, `csharp`, `css`, `dart`, `diff`, `docker`, `elixir`, `elm`, `erlang`, `flow`, `fortran`, `fsharp`, `gherkin`, `glsl`, `go`, `graphql`, `groovy`, `haskell`, `html`, `java`, `javascript`, `json`, `julia`, `kotlin`, `latex`, `less`, `lisp`, `livescript`, `lua`, `makefile`, `markdown`, `markup`, `matlab`, `mermaid`, `nix`, `objective-c`, `ocaml`, `pascal`, `perl`, `php`, `plain text`, `powershell`, `prolog`, `protobuf`, `python`, `r`, `reason`, `ruby`, `rust`, `sass`, `scala`, `scheme`, `scss`, `shell`, `sql`, `swift`, `toml`, `typescript`, `vb.net`, `verilog`, `vhdl`, `visual basic`, `webassembly`, `xml`, `yaml`, `zig`

## Media Blocks

### Image

```json
{ "type": "image", "image": { "type": "external", "external": { "url": "https://..." } } }
```

### Video

```json
{ "type": "video", "video": { "type": "external", "external": { "url": "https://..." } } }
```

### File

```json
{ "type": "file", "file": { "type": "external", "external": { "url": "https://..." }, "caption": [], "name": "document.pdf" } }
```

### PDF

```json
{ "type": "pdf", "pdf": { "type": "external", "external": { "url": "https://..." }, "caption": [] } }
```

### Audio

```json
{ "type": "audio", "audio": { "type": "external", "external": { "url": "https://..." } } }
```

All media blocks support `"type": "file"` (Notion-hosted, with `file.url` + `file.expiry_time`) and `"type": "external"` (user-provided URL).

## Embed & Link Blocks

### Bookmark

```json
{ "type": "bookmark", "bookmark": { "url": "https://...", "caption": [] } }
```

### Embed

```json
{ "type": "embed", "embed": { "url": "https://..." } }
```

### Link Preview

```json
{ "type": "link_preview", "link_preview": { "url": "https://..." } }
```

Read-only — cannot be created via API.

## Structural Blocks

### Divider

```json
{ "type": "divider", "divider": {} }
```

### Table of Contents

```json
{ "type": "table_of_contents", "table_of_contents": { "color": "default" } }
```

### Breadcrumb

```json
{ "type": "breadcrumb", "breadcrumb": {} }
```

### Equation

```json
{ "type": "equation", "equation": { "expression": "E = mc^2" } }
```

## Table Blocks

### Table

```json
{ "type": "table", "table": { "table_width": 3, "has_column_header": true, "has_row_header": false } }
```

Children must be `table_row` blocks.

### Table Row

```json
{
  "type": "table_row",
  "table_row": {
    "cells": [
      [{ "type": "text", "text": { "content": "Cell 1" } }],
      [{ "type": "text", "text": { "content": "Cell 2" } }],
      [{ "type": "text", "text": { "content": "Cell 3" } }]
    ]
  }
}
```

Each cell is an array of rich text objects. Number of cells must match `table_width`.

## Layout Blocks

### Column List

```json
{ "type": "column_list", "column_list": {} }
```

Children must be `column` blocks.

### Column

```json
{ "type": "column", "column": {} }
```

Children are the blocks within the column.

## Child Blocks

### Child Page

```json
{ "type": "child_page", "child_page": { "title": "Page Title" } }
```

### Child Database

```json
{ "type": "child_database", "child_database": { "title": "Database Name" } }
```

## Advanced Blocks

### Synced Block (Original)

```json
{ "type": "synced_block", "synced_block": { "synced_from": null, "children": [] } }
```

### Synced Block (Reference)

```json
{ "type": "synced_block", "synced_block": { "synced_from": { "type": "block_id", "block_id": "..." } } }
```

### Template

```json
{ "type": "template", "template": { "rich_text": [], "children": [] } }
```

## Color Values

Available for text blocks: `default`, `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`

Background variants: `gray_background`, `brown_background`, `orange_background`, `yellow_background`, `green_background`, `blue_background`, `purple_background`, `pink_background`, `red_background`

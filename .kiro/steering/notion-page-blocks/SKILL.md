---
name: notion-page-blocks
description: "Notion page and block content management — create pages with rich content, read and render block trees, append/update/delete blocks, convert between Notion blocks and HTML/Markdown. Use this skill whenever the user wants to create Notion pages with content, read page content as blocks, build a Notion-powered CMS or blog, render Notion content to HTML, manipulate block children, work with Notion's rich text format, add headings/lists/code/images/embeds to Notion pages, or convert Notion blocks to any output format. Triggers on 'Notion page content', 'Notion blocks', 'render Notion to HTML', 'add content to Notion', 'Notion rich text', 'Notion CMS', 'read Notion page', 'write to Notion page', or any request about page-level content in Notion."
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

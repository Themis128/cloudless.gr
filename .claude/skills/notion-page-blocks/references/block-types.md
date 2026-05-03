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

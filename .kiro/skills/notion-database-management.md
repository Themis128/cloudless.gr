---
inclusion: manual
---

# Notion Database Management

This skill covers the full lifecycle of Notion databases via the REST API (version `2022-06-28`+). It teaches you how to create, query, update, and manage databases and their records (pages).

## Authentication

Every request requires two headers:

```
Authorization: Bearer <NOTION_API_KEY>
Notion-Version: 2022-06-28
Content-Type: application/json
```

The API key is an "Internal Integration Secret" from <https://www.notion.so/my-integrations>. Each database must be shared with the integration (database → … → Connections → add your integration).

Base URL: `https://api.notion.com/v1`

## Core Endpoints

### Create a Database

**POST** `/v1/databases`

Creates a new database as a child of an existing page. You define the schema via `properties`.

```json
{
  "parent": { "type": "page_id", "page_id": "<parent-page-uuid>" },
  "title": [{ "type": "text", "text": { "content": "My Database" } }],
  "properties": {
    "Name": { "title": {} },
    "Status": {
      "select": {
        "options": [
          { "name": "Active", "color": "green" },
          { "name": "Archived", "color": "gray" }
        ]
      }
    },
    "Priority": { "number": { "format": "number" } },
    "Tags": { "multi_select": { "options": [] } },
    "Due Date": { "date": {} },
    "Done": { "checkbox": {} },
    "URL": { "url": {} },
    "Description": { "rich_text": {} }
  }
}
```

### Retrieve a Database

**GET** `/v1/databases/{database_id}`

Returns the database object with its schema (property definitions), title, and metadata.

### Update a Database

**PATCH** `/v1/databases/{database_id}`

Modify title, description, or add/rename properties. You cannot delete properties via the API — only add new ones or update existing ones.

### Query a Database

**POST** `/v1/databases/{database_id}/query`

The most-used endpoint. Returns pages matching your filters, sorted as specified, with cursor-based pagination.

Read `references/filters-and-sorts.md` for the complete filter operator reference.

```json
{
  "filter": {
    "and": [
      { "property": "Status", "select": { "equals": "Active" } },
      { "property": "Priority", "number": { "greater_than": 2 } }
    ]
  },
  "sorts": [
    { "property": "Priority", "direction": "descending" },
    { "timestamp": "created_time", "direction": "ascending" }
  ],
  "page_size": 100,
  "start_cursor": "<cursor-from-previous-response>"
}
```

**Pagination**: If `has_more` is `true` in the response, pass `next_cursor` as `start_cursor` in the next request. Max `page_size` is 100.

## Property Types Reference

When creating databases or writing page properties, use these JSON shapes:

| Type | Schema definition | Page property value |
|------|-------------------|---------------------|
| Title | `{ "title": {} }` | `{ "title": [{ "text": { "content": "Hello" } }] }` |
| Rich Text | `{ "rich_text": {} }` | `{ "rich_text": [{ "text": { "content": "..." } }] }` |
| Number | `{ "number": { "format": "number" } }` | `{ "number": 42 }` |
| Select | `{ "select": { "options": [...] } }` | `{ "select": { "name": "Option A" } }` |
| Multi-select | `{ "multi_select": { "options": [...] } }` | `{ "multi_select": [{ "name": "Tag1" }, { "name": "Tag2" }] }` |
| Date | `{ "date": {} }` | `{ "date": { "start": "2026-04-13", "end": null } }` |
| Checkbox | `{ "checkbox": {} }` | `{ "checkbox": true }` |
| URL | `{ "url": {} }` | `{ "url": "https://example.com" }` |
| Email | `{ "email": {} }` | `{ "email": "hi@example.com" }` |
| Phone | `{ "phone_number": {} }` | `{ "phone_number": "+1-555-0123" }` |
| Files | `{ "files": {} }` | `{ "files": [{ "name": "doc.pdf", "type": "external", "external": { "url": "..." } }] }` |
| Status | `{ "status": { "options": [...], "groups": [...] } }` | `{ "status": { "name": "In Progress" } }` |
| Relation | `{ "relation": { "database_id": "..." } }` | `{ "relation": [{ "id": "<page-id>" }] }` |

## Creating Pages (Database Records)

**POST** `/v1/pages`

```json
{
  "parent": { "database_id": "<database-uuid>" },
  "properties": {
    "Name": { "title": [{ "text": { "content": "New Record" } }] },
    "Status": { "select": { "name": "Active" } },
    "Tags": { "multi_select": [{ "name": "important" }] },
    "Due Date": { "date": { "start": "2026-04-20" } }
  }
}
```

## Updating Pages (Database Records)

**PATCH** `/v1/pages/{page_id}`

Send only the properties you want to change:

```json
{
  "properties": {
    "Status": { "select": { "name": "Done" } },
    "Done": { "checkbox": true }
  }
}
```

## Archiving / Deleting Pages

**PATCH** `/v1/pages/{page_id}` with `{ "archived": true }` to soft-delete (move to trash).

**DELETE** `/v1/pages/{page_id}` to permanently trash (API version 2023-08-01+).

## Pagination Helper Pattern

For any language, the pagination loop looks like:

```typescript
async function queryAll(databaseId: string, filter?: object) {
  const results = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify({ filter, start_cursor: cursor, page_size: 100 }),
    });
    const data = await res.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}
```

## Common Patterns

**Extract plain text from a rich_text property:**

```typescript
const text = page.properties.Description.rich_text.map(t => t.plain_text).join("");
```

**Extract select value:**

```typescript
const status = page.properties.Status.select?.name ?? "";
```

**Extract multi-select values:**

```typescript
const tags = page.properties.Tags.multi_select.map(t => t.name);
```

**Extract date:**

```typescript
const date = page.properties["Due Date"].date?.start ?? "";
```

## Error Handling

| Status | Meaning | Fix |
|--------|---------|-----|
| 400 | Invalid request body | Check property names/types match schema |
| 401 | Bad token | Verify NOTION_API_KEY |
| 403 | Not shared | Share database with integration |
| 404 | Not found | Check database/page ID |
| 409 | Conflict | Retry (concurrent edit) |
| 429 | Rate limited | Back off, retry after `Retry-After` header |

Rate limit: ~3 requests/second average. Use exponential backoff on 429s.

## Reference Files

For the complete filter operator reference with every property type and condition, read:
→ `references/filters-and-sorts.md`


## Reference: filters-and-sorts.md

# Notion Database Query Filters & Sorts — Complete Reference

## Filter Structure

Every filter targets a `property` by name and applies a typed condition:

```json
{ "property": "PropertyName", "<type>": { "<operator>": <value> } }
```

## Compound Filters

```json
{ "and": [ { ...filter1 }, { ...filter2 } ] }
{ "or":  [ { ...filter1 }, { ...filter2 } ] }
```

Nesting supported up to two levels deep. You can combine `and`/`or`.

---

## Filter Operators by Property Type

### Rich Text / Title

```json
{ "property": "Name", "rich_text": { "contains": "search term" } }
```

Operators: `equals`, `does_not_equal`, `contains`, `does_not_contain`, `starts_with`, `ends_with`, `is_empty` (true), `is_not_empty` (true)

Title uses the same operators with `"title"` instead of `"rich_text"`.

### Number

```json
{ "property": "Score", "number": { "greater_than": 80 } }
```

Operators: `equals`, `does_not_equal`, `greater_than`, `greater_than_or_equal_to`, `less_than`, `less_than_or_equal_to`, `is_empty`, `is_not_empty`

### Checkbox

```json
{ "property": "Done", "checkbox": { "equals": true } }
```

Operators: `equals`, `does_not_equal` (boolean values only)

### Select

```json
{ "property": "Status", "select": { "equals": "Active" } }
```

Operators: `equals`, `does_not_equal`, `is_empty`, `is_not_empty`

The value can be a string or string array.

### Multi-Select

```json
{ "property": "Tags", "multi_select": { "contains": "urgent" } }
```

Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

### Status

```json
{ "property": "Status", "status": { "equals": "In Progress" } }
```

Operators: `equals`, `does_not_equal`, `is_empty`, `is_not_empty`

### Date

```json
{ "property": "Due Date", "date": { "on_or_before": "2026-04-30" } }
```

**Exact/range operators**: `equals`, `before`, `after`, `on_or_before`, `on_or_after`
Values: ISO 8601 date string (`"2026-04-13"`) or datetime (`"2026-04-13T00:00:00Z"`)

**Relative operators** (value is empty object `{}`):
`past_week`, `past_month`, `past_year`, `this_week`, `next_week`, `next_month`, `next_year`

**Empty checks**: `is_empty`, `is_not_empty`

### People

```json
{ "property": "Assignee", "people": { "contains": "<user-uuid>" } }
```

Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

Use `"me"` as value for the current bot user.

### Files

Operators: `is_empty`, `is_not_empty` only

### Relation

```json
{ "property": "Project", "relation": { "contains": "<page-uuid>" } }
```

Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

### Unique ID

```json
{ "property": "ID", "unique_id": { "equals": 42 } }
```

Operators: `equals`, `does_not_equal`, `greater_than`, `greater_than_or_equal_to`, `less_than`, `less_than_or_equal_to`

### Formula

The filter type depends on the formula's result type. Wrap in `"formula"`:

```json
{ "property": "Computed", "formula": { "number": { "greater_than": 10 } } }
{ "property": "IsActive", "formula": { "checkbox": { "equals": true } } }
```

### Rollup

```json
{ "property": "TotalTasks", "rollup": { "number": { "greater_than": 5 } } }
{ "property": "AllComplete", "rollup": { "every": { "rich_text": { "is_not_empty": true } } } }
```

Array aggregations: `any`, `every`, `none` (with nested property filter).
Single value: `number`, `date` (with nested typed filter).

### Timestamp Filters

Filter by creation or edit time without a property name:

```json
{ "timestamp": "created_time", "created_time": { "after": "2026-01-01" } }
{ "timestamp": "last_edited_time", "last_edited_time": { "past_week": {} } }
```

---

## Sort Structure

```json
{
  "sorts": [
    { "property": "Priority", "direction": "descending" },
    { "property": "Name", "direction": "ascending" },
    { "timestamp": "created_time", "direction": "descending" }
  ]
}
```

**Direction**: `"ascending"` or `"descending"` (default: ascending)

**By property**: `{ "property": "PropertyName", "direction": "..." }`
**By timestamp**: `{ "timestamp": "created_time" | "last_edited_time", "direction": "..." }`

Sort order matters — earlier sorts take precedence. All sortable property types are supported (text, number, date, select, checkbox, etc.).

---

## Practical Examples

### Active items due this week

```json
{
  "filter": {
    "and": [
      { "property": "Status", "status": { "does_not_equal": "Done" } },
      { "property": "Due Date", "date": { "this_week": {} } }
    ]
  },
  "sorts": [{ "property": "Priority", "direction": "descending" }]
}
```

### Search by text with pagination

```json
{
  "filter": {
    "property": "Title",
    "title": { "contains": "serverless" }
  },
  "page_size": 20,
  "start_cursor": "abc123..."
}
```

### Published blog posts, newest first

```json
{
  "filter": {
    "property": "Published",
    "checkbox": { "equals": true }
  },
  "sorts": [
    { "property": "Date", "direction": "descending" }
  ]
}
```

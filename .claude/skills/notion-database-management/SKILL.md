---
name: notion-database-management
description: "Complete Notion database lifecycle management via the REST API — create databases, query with filters/sorts/pagination, update schemas, and manage properties. Use this skill whenever the user mentions Notion databases, wants to query Notion data, create or modify database schemas, filter or sort Notion records, build database-backed features, or work with Notion property types. Also triggers on 'query Notion', 'filter Notion', 'Notion database schema', 'create Notion DB', 'Notion properties', 'paginated Notion query', or any request involving structured data in Notion. Even if the user just says 'pull data from Notion' or 'store this in Notion' — use this skill."
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

The API key is an "Internal Integration Secret" from https://www.notion.so/my-integrations. Each database must be shared with the integration (database → … → Connections → add your integration).

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
